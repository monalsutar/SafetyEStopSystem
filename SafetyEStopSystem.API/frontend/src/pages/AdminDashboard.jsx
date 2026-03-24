//export default AdminDashboard;

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

// Navbar
import Navbar from '../components/Layout/Navbar';

// API (named export)
import { stationAPI } from '../api/apiService';
import { userAPI } from '../api/apiService';

import { Loader2 } from 'lucide-react';

// Icons
import {
    Activity, AlertCircle, CheckCircle, MapPin, Plus, Download,
    BarChart3, PieChart, Calendar, TrendingUp, Pencil,
} from 'lucide-react';

// Recharts
import {
    ResponsiveContainer, BarChart as ReBarChart, Bar,
    PieChart as RePieChart, Pie, Cell, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend,
} from 'recharts';


// Datepicker styles
import "react-datepicker/dist/react-datepicker.css";

// Components
import StatCard from '../components/dashboard/StatCard';
import EStopBanner from '../components/dashboard/EStopBanner';
import Tabs from '../components/dashboard/Tabs';
import CreateStationForm from '../components/dashboard/CreateStationForm';
import IncidentsList from '../components/dashboard/IncidentsList';
import RecentIncidentsTable from '../components/dashboard/RecentIncidentsTable';
import EditStationModal from '../components/dashboard/EditStationModal';

// Reports components
import ReportsFilters from '../components/dashboard/Reports/ReportsFilters';
import IncidentsByDayChart from '../components/dashboard/Reports/IncidentsByDayChart';
import IncidentsByStationChart from '../components/dashboard/Reports/IncidentsByStationChart';
import StatusPieChart from '../components/dashboard/Reports/StatusPieChart';
import TopStationsChart from '../components/dashboard/Reports/TopStationsChart';

// Utils
import {
    formatDateTime,
    resolveStationName,
    resolveStationLocation,
} from '../utils/dateTime';
import { downloadCsv } from '../utils/csv';
import { useAuth } from "../context/AuthContext";

const PIE_COLORS = ['#F59E0B', '#10B981', '#EF4444', '#3B82F6'];

// helper to try several method names on stationAPI
const callFirstAvailable = async (obj, methodNames = [], ...args) => {
    for (const name of methodNames) {
        if (obj && typeof obj[name] === 'function') {
            return await obj[name](...args);
        }
    }
    throw new Error(`No endpoint found. Tried: ${methodNames.join(', ')}`);
};

// compute top stations from any incidents list 
const computeTopStations = (incidents = []) => {
    const byStationMap = new Map();
    (incidents || []).forEach((inc) => {
        const sname =
            inc?.station?.name ??
            inc?.station?.Name ??
            inc?.Station?.Name ??
            'Unknown';
        byStationMap.set(sname, (byStationMap.get(sname) || 0) + 1);
    });

    return Array.from(byStationMap.entries())
        .map(([stationName, count]) => ({ stationName, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
};

const AdminDashboard = () => {
    const { user } = useAuth();
    const role = user?.role;

    // Normalize role checks once
    const isOperator = useMemo(() => String(role || '').toLowerCase() === 'operator', [role]);

    const tabs = useMemo(() => {
        if (String(role || '').toLowerCase() === "admin") return ['Overview', 'Incidents', 'Reports'];
        if (isOperator) return ['Overview', 'Incidents'];
        return ['Overview', 'Incidents', 'Reports']; // supervisors
    }, [role, isOperator]);

    const deny = (msg = "You don't have permission to do that.") => toast.error(msg);

    // Acknowledge modal
    const [showAckForm, setShowAckForm] = useState(false);
    const [ackIncidentId, setAckIncidentId] = useState(null);
    const [ackForm, setAckForm] = useState({ issue: '', comment: '' });
    const [submittingAck, setSubmittingAck] = useState(false);

    // Close modal
    const [showCloseForm, setShowCloseForm] = useState(false);
    const [closeIncidentId, setCloseIncidentId] = useState(null);
    const [closeForm, setCloseForm] = useState({ comment: '' });
    const [submittingClose, setSubmittingClose] = useState(false);

    const [stats, setStats] = useState(null);
    const [incidents, setIncidents] = useState([]);
    const [stations, setStations] = useState([]);
    const [showCreateStation, setShowCreateStation] = useState(false);
    const [newStation, setNewStation] = useState({ name: '', location: '' });
    const [loading, setLoading] = useState(true);

    // Tabs / analytics
    const [activeTab, setActiveTab] = useState('Overview');
    const [chartData, setChartData] = useState(null);
    const [recentIncidents, setRecentIncidents] = useState([]);
    const [selectedStation, setSelectedStation] = useState('');

    // Users tab filters
    const [userSearch, setUserSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    // Reports filters
    const now = new Date();
    const [fromMonth, setFromMonth] = useState(now.getMonth() + 1);
    const [fromYear, setFromYear] = useState(now.getFullYear());
    const [toMonth, setToMonth] = useState(now.getMonth() + 1);
    const [toYear, setToYear] = useState(now.getFullYear());

    // Day-level range (YYYY-MM-DD)
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; // first of current month
    });
    const [toDate, setToDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    const [allIncidents, setAllIncidents] = useState([]);
    const [filteredIncidents, setFilteredIncidents] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [downloadingReport, setDownloadingReport] = useState(false);

    // Time & refresh
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [currentTime, setCurrentTime] = useState(new Date());

    // Edit modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editStation, setEditStation] = useState(null);

    // Per-station loading map
    const [stationLoading, setStationLoading] = useState({});
    const setLoadingById = (id, v) => setStationLoading((p) => ({ ...p, [id]: v }));

    // UTC parser
    const parseUtcDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) return val;
        if (typeof val === 'string') {
            const hasTZ = /Z|[+-]\d{2}:\d{2}$/.test(val);
            const s = hasTZ ? val : `${val}Z`;
            const d = new Date(s);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(val);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const dateTimeFmt = useMemo(() => {
        const locale = navigator.language || 'en-US';
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: tz,
            timeZoneName: 'short',
        });
    }, [tz]);

    useEffect(() => {
        if (isOperator && activeTab === 'Reports') {
            setActiveTab('Overview');
        }
    }, [isOperator, activeTab]);

    useEffect(() => {
        const id = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        loadDashboardData();
    }, []);

    // Auto-refresh every 5s when tab visible
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') {
                loadDashboardData();
            }
        }, 5000);
        return () => clearInterval(id);
    }, []);

    // Fetch all incidents when entering Reports (single effect - deduped)
    useEffect(() => {
        const loadAllIncidents = async () => {
            try {
                setReportsLoading(true);
                const res = await stationAPI.getIncidents();
                setAllIncidents(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
            } finally {
                setReportsLoading(false);
            }
        };
        if (activeTab === 'Reports' && !isOperator) {
            loadAllIncidents();
        }
    }, [activeTab, isOperator]);

    // Filter incidents by date range + station 
    useEffect(() => {
        if (!allIncidents?.length) {
            setFilteredIncidents([]);
            return;
        }

        const hasFullDates = Boolean(fromDate && toDate);
        const start = hasFullDates
            ? new Date(`${fromDate}T00:00:00`)
            : new Date(fromYear, fromMonth - 1, 1, 0, 0, 0, 0);

        const end = hasFullDates
            ? new Date(`${toDate}T23:59:59.999`)
            : new Date(toYear, toMonth, 0, 23, 59, 59, 999);

        const result = allIncidents.filter((inc) => {
            const when = new Date(inc.triggeredAt ?? inc.TriggeredAt);
            if (Number.isNaN(when.getTime())) return false;

            const inRange = when >= start && when <= end;

            const stationId =
                inc.station?.id ??
                inc.station?.Id ??
                inc.StationId ??
                inc.Station?.Id ??
                null;

            const stationMatch = selectedStation
                ? String(stationId) === String(selectedStation)
                : true;

            return inRange && stationMatch;
        });

        setFilteredIncidents(result);
    }, [
        allIncidents,
        selectedStation,
        // month/year
        fromMonth, fromYear, toMonth, toYear,
        // days
        fromDate, toDate,
    ]);

    // Compute reports charts from filtered
    const computeCharts = () => {
        const byDayMap = new Map();
        const byStationMap = new Map();
        const statusMap = new Map();

        (filteredIncidents || []).forEach((inc) => {
            const when = parseUtcDate(inc?.triggeredAt ?? inc?.TriggeredAt);
            if (!when) return;

            const dayKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(
                when.getDate(),
            ).padStart(2, '0')}`;
            byDayMap.set(dayKey, (byDayMap.get(dayKey) || 0) + 1);

            const sname = inc?.station?.name ?? inc?.station?.Name ?? inc?.Station?.Name ?? 'Unknown';
            byStationMap.set(sname, (byStationMap.get(sname) || 0) + 1);

            const st = inc?.status ?? inc?.Status ?? 'Unknown';
            statusMap.set(st, (statusMap.get(st) || 0) + 1);
        });

        const incidentsByDay = Array.from(byDayMap.entries())
            .sort(([a], [b]) => new Date(a) - new Date(b))
            .map(([date, count]) => ({ date, count }));

        const incidentsByStation = Array.from(byStationMap.entries())
            .map(([stationName, count]) => ({ stationName, count }))
            .sort((a, b) => b.count - a.count);

        const statusSplit = Array.from(statusMap.entries()).map(([status, value]) => ({
            status,
            value,
        }));

        const topStations = incidentsByStation.slice(0, 5);

        return { incidentsByDay, incidentsByStation, statusSplit, topStations };
    };

    // For top-stations (global) chart use only date range (same as filteredIncidents but ignoring station filter)
    const dateOnlyIncidents = useMemo(() => {
        if (!allIncidents?.length) return [];

        const hasFullDates = Boolean(fromDate && toDate);
        const start = hasFullDates
            ? new Date(`${fromDate}T00:00:00`)
            : new Date(fromYear, fromMonth - 1, 1, 0, 0, 0, 0);

        const end = hasFullDates
            ? new Date(`${toDate}T23:59:59.999`)
            : new Date(toYear, toMonth, 0, 23, 59, 59, 999);

        return allIncidents.filter((inc) => {
            const when = new Date(inc.triggeredAt ?? inc.TriggeredAt);
            if (Number.isNaN(when.getTime())) return false;
            return when >= start && when <= end;
        });
    }, [allIncidents, fromMonth, fromYear, toMonth, toYear, fromDate, toDate]);

    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const view = searchParams.get('view');
        const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

        if (view === 'users' && isAdmin) {
            setActiveTab('Users');

            // Clean the query string so refreshing doesn't keep re-opening it
            searchParams.delete('view');
            const cleaned = searchParams.toString();
            const newUrl = cleaned ? `${location.pathname}?${cleaned}` : location.pathname;
            navigate(newUrl, { replace: true });
        }
    }, [location, navigate, user]);

    const topStationsGlobal = useMemo(
        () => computeTopStations(dateOnlyIncidents),
        [dateOnlyIncidents]
    );

    const chartLocal = computeCharts();

    // ---------- Users tab state ----------
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);

    const [newUser, setNewUser] = useState({
        fullName: '',
        email: '',
        role: 'Operator',
        password: '',
    });

    // Delete user (cannot delete Admin)
    const handleDeleteUser = async (id, userRole) => {
        if (userRole === 'Admin') {
            toast.error('You cannot delete another Admin.');
            return;
        }
        if (!confirm('Delete this user? This action cannot be undone.')) return;

        try {
            await userAPI.delete(id);
            toast.success('User deleted');
            await loadUsers();
        } catch (err) {
            console.error(err);
            if (err?.response?.status === 404) {
                toast.error('User not found on server (404). Try refreshing the list.');
                await loadUsers();
                return;
            }
            const msg =
                err?.response?.data?.message ||
                (typeof err?.response?.data === 'string' ? err.response.data : undefined) ||
                err?.message ||
                'Failed to delete user';
            toast.error(msg);
        }
    };

    // Derived filtered users
    const filteredUsers = useMemo(() => {
        const term = userSearch.trim().toLowerCase();
        return (users || []).filter((u) => {
            const matchesRole = roleFilter ? u.role === roleFilter : true;
            const matchesTerm =
                !term ||
                (u.fullName && u.fullName.toLowerCase().includes(term)) ||
                (u.email && u.email.toLowerCase().includes(term));
            return matchesRole && matchesTerm;
        });
    }, [users, userSearch, roleFilter]);

    // Load users when Users tab is active
    const loadUsers = async () => {
        try {
            setUsersLoading(true);
            const res = await userAPI.getAll();
            setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load users');
        } finally {
            setUsersLoading(false);
        }
    };

    // Change password handler passed to Navbar
    const handleChangePassword = async ({ currentPassword, newPassword }) => {
        // Try common method names to match your backend
        const tryNames = ['changePassword', 'updatePassword', 'resetPasswordSelf', 'setPassword'];

        const body = { currentPassword, newPassword };

        try {
            // Reuse your callFirstAvailable helper if present in this file
            if (typeof callFirstAvailable === 'function') {
                await callFirstAvailable(userAPI, tryNames, body);
            } else {
                // Fallback: call a likely method directly
                await userAPI.changePassword(body);
            }

            toast.success('Password updated successfully');

            // Optional: force logout on success for security
            // localStorage.removeItem('token');
            // window.location.href = '/login';
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.message ||
                (typeof err?.response?.data === 'string' ? err.response.data : undefined) ||
                err?.message ||
                'Failed to change password';
            toast.error(msg);
            throw err; // let Navbar show inline error if needed
        }
    };

    useEffect(() => {
        if (activeTab === 'Users' && String(role || '').toLowerCase() === 'admin') {
            loadUsers();
        }
    }, [activeTab, role]);

    const displayName = user?.fullName || user?.name || user?.email || 'Account';

    const handleLogout = async () => {
        try {
            localStorage.removeItem('token');
        } finally {
            window.location.href = '/login';
        }
    };

    const handleOpenUsersFromNavbar = () => {
        const isAdmin = String(role || '').toLowerCase() === 'admin';
        if (!isAdmin) {
            toast.error('Only admins can manage users.');
            return;
        }
        setActiveTab('Users');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Overview charts from last 30 days of all incidents
    const loadDashboardData = async () => {
        const toNumOrUndef = (v) => {
            if (v == null) return undefined;
            const n = typeof v === 'string' ? Number(v) : v;
            return Number.isFinite(n) ? n : undefined;
        };
        const pickNumber = (obj, keys) => {
            for (const k of keys) {
                const v = obj?.[k];
                const n = toNumOrUndef(v);
                if (n !== undefined) return n;
            }
            return undefined;
        };

        try {
            setLoading(true);

            const [
                statsRes,
                alertsRes,
                stationsRes,
                recentRes,
                allIncidentsRes,
                stationStatusRes,
            ] = await Promise.all([
                stationAPI.getDashboardStats(),
                stationAPI.getAlerts(),
                stationAPI.getAll(),
                stationAPI.getRecentIncidents().catch(() => ({ data: [] })),
                stationAPI.getIncidents().catch(() => ({ data: [] })), // admin endpoint; may need auth
                stationAPI.getStationStatus().catch(() => ({ data: [] })),
            ]);

            // Normalize arrays
            const stationsArr = Array.isArray(stationsRes?.data) ? stationsRes.data : [];
            const alertsArr = Array.isArray(alertsRes?.data) ? alertsRes.data : [];
            const all = Array.isArray(allIncidentsRes?.data) ? allIncidentsRes.data : [];
            const statusArr = Array.isArray(stationStatusRes?.data) ? stationStatusRes.data : [];

            // Build a map: stationId -> total incident count (historical)
            const countByStationId = new Map();
            for (const inc of all) {
                const sid =
                    inc?.station?.id ??
                    inc?.station?.Id ??
                    inc?.StationId ??
                    inc?.Station?.Id ??
                    null;
                if (sid != null) {
                    const key = String(sid);
                    countByStationId.set(key, (countByStationId.get(key) || 0) + 1);
                }
            }

            // Merge station-level status flags for UI
            const statusById = new Map(
                statusArr.map((s) => {
                    const rawLatest = s.latestIncidentStatus ?? s.LatestIncidentStatus ?? null;
                    const latestStatus = typeof rawLatest === 'string' ? rawLatest.trim() : rawLatest;
                    const latestLower = String(latestStatus || '').toLowerCase();
                    const isWaitingForAck = latestLower === 'open';
                    return [
                        (s.id ?? s.Id),
                        {
                            id: s.id ?? s.Id,
                            isInAlert: isWaitingForAck,
                            hasUnresolvedIncident: isWaitingForAck,
                            latestIncidentStatus: latestStatus,
                        }
                    ];
                })
            );

            const stationsWithStatus = stationsArr.map((s) => {
                const st = statusById.get(s.id ?? s.Id) || {};
                return {
                    ...s,
                    isActive: s?.isActive ?? s?.IsActive ?? true,
                    isInAlert: st.isInAlert ?? false,
                    hasUnresolvedIncident: st.hasUnresolvedIncident ?? false,
                    latestIncidentStatus: st.latestIncidentStatus ?? null,
                    incidentCount: countByStationId.get(String(s.id ?? s.Id)) || 0,
                };
            });

            // Stats with fallback derived from incidents
            const sdata = statsRes?.data ?? {};
            let mappedStats = {
                totalStations:
                    pickNumber(sdata, [
                        'totalStations', 'TotalStations', 'stationsCount', 'StationsCount',
                    ]) ?? stationsArr.length,

                openIncidents: pickNumber(sdata, [
                    'openIncidents', 'OpenIncidents', 'Open', 'open',
                    'OpenCount', 'OpenIncidentsCount', 'TotalOpenIncidents',
                ]),

                acknowledgedIncidents: pickNumber(sdata, [
                    'acknowledgedIncidents', 'AcknowledgedIncidents', 'Acknowledged',
                    'acknowledged', 'Ack', 'AckCount', 'AcknowledgedCount',
                    'TotalAcknowledgedIncidents',
                ]),

                closedIncidents: pickNumber(sdata, [
                    'closedIncidents', 'ClosedIncidents', 'Closed', 'closed',
                    'ClosedCount', 'ClosedIncidentsCount', 'TotalClosedIncidents',
                ]),

                totalIncidents: pickNumber(sdata, [
                    'totalIncidents', 'TotalIncidents', 'Incidents', 'IncidentsCount', 'Total',
                ]),
            };

            if (
                mappedStats.openIncidents === undefined ||
                mappedStats.acknowledgedIncidents === undefined ||
                mappedStats.closedIncidents === undefined ||
                mappedStats.totalIncidents === undefined
            ) {
                let open = 0, ack = 0, closed = 0;
                for (const inc of all) {
                    const st = (inc?.status ?? inc?.Status ?? '').toString().toLowerCase();
                    if (st === 'open') open += 1;
                    else if (st === 'acknowledged' || st === 'ack' || st === 'acknowledge') ack += 1;
                    else if (st === 'closed' || st === 'close') closed += 1;
                }
                const total = open + ack + closed;

                mappedStats = {
                    ...mappedStats,
                    openIncidents: mappedStats.openIncidents ?? open,
                    acknowledgedIncidents: mappedStats.acknowledgedIncidents ?? ack,
                    closedIncidents: mappedStats.closedIncidents ?? closed,
                    totalIncidents: mappedStats.totalIncidents ?? total,
                };
            }

            setStats(mappedStats);
            setIncidents(alertsArr);
            setStations(stationsWithStatus);

            // Overview charts from last 30 days of all incidents
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);

            const last30 = all.filter((i) => {
                const d = parseUtcDate(i?.triggeredAt ?? i?.TriggeredAt);
                return d && d >= cutoff;
            });

            const deriveOverviewFrom = (list) => {
                const byStationMap = new Map();
                const statusMap = new Map();
                const byDayMap = new Map();

                list.forEach((i) => {
                    const sname =
                        i?.station?.name ??
                        i?.station?.Name ??
                        i?.Station?.Name ??
                        i?.StationName ??
                        'Unknown';

                    const status = i?.status ?? i?.Status ?? 'Unknown';

                    const d = new Date(i?.triggeredAt ?? i?.TriggeredAt);
                    if (!Number.isNaN(d.getTime())) {
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                            d.getDate(),
                        ).padStart(2, '0')}`;
                        byDayMap.set(key, (byDayMap.get(key) || 0) + 1);
                    }

                    byStationMap.set(sname, (byStationMap.get(sname) || 0) + 1);
                    statusMap.set(status, (statusMap.get(status) || 0) + 1);
                });

                const incidentsByStation = Array.from(byStationMap.entries())
                    .map(([stationName, count]) => ({ stationName, count }))
                    .sort((a, b) => b.count - a.count);

                const statusSplit = Array.from(statusMap.entries()).map(([status, value]) => ({
                    status,
                    value,
                }));

                const incidentsByDay = Array.from(byDayMap.entries())
                    .map(([date, count]) => ({ date, count }))
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                const topStations = incidentsByStation.slice(0, 5);

                return { incidentsByStation, statusSplit, incidentsByDay, topStations };
            };

            const overviewCharts = deriveOverviewFrom(last30);
            setChartData(overviewCharts);

            // Recent incidents table
            setRecentIncidents(Array.isArray(recentRes?.data) ? recentRes.data : []);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    // --- Actions ---
    // --- Actions ---
    const handleAcknowledge = (incidentId) => {
        if (isOperator) { deny(); return; }
        setAckIncidentId(incidentId);
        setAckForm({ issue: '', comment: '' });
        setShowAckForm(true);
    };

    const handleClose = (incidentId) => {
        if (isOperator) { deny(); return; }
        setCloseIncidentId(incidentId);
        setCloseForm({ comment: '' });
        setShowCloseForm(true);
    };

    const handleSubmitAcknowledge = async (e) => {
        e.preventDefault();
        if (!ackIncidentId) return;
        if (!ackForm.issue || !ackForm.issue.trim()) {
            toast.error('Please specify what the issue was about.');
            return;
        }
        try {
            setSubmittingAck(true);
            await stationAPI.acknowledge(ackIncidentId, {
                issue: ackForm.issue.trim(),
                comment: ackForm.comment?.trim() ?? null,
            });
            toast.success('Incident acknowledged');
            setShowAckForm(false);
            setAckIncidentId(null);
            setAckForm({ issue: '', comment: '' });
            await loadDashboardData();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message ?? 'Failed to acknowledge incident');
        } finally {
            setSubmittingAck(false);
        }
    };

    const handleSubmitClose = async (e) => {
        e.preventDefault();
        if (!closeIncidentId) return;
        try {
            setSubmittingClose(true);
            await stationAPI.closeIncident(closeIncidentId, {
                comment: closeForm.comment?.trim() ?? null,
            });
            toast.success('Incident closed');
            setShowCloseForm(false);
            setCloseIncidentId(null);
            setCloseForm({ comment: '' });
            await loadDashboardData();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message ?? 'Failed to close incident');
        } finally {
            setSubmittingClose(false);
        }
    };

    const handleCreateStation = async (e) => {
        e.preventDefault();
        try {
            const name = newStation.name?.trim() ?? '';
            const location = newStation.location?.trim() ?? '';

            if (!name) {
                toast.warning('Station name is required');
                return;
            }

            const normalized = (s) => (s ?? '').trim().toLowerCase();

            const nameExists = stations?.some(s => normalized(s.name) === normalized(name));
            if (nameExists) {
                toast.error(`A station with the name "${name}" already exists`);
                return;
            }

            const locationExists = location
                ? stations?.some(s => normalized(s.location) === normalized(location))
                : false;

            if (locationExists) {
                toast.error(`A station with the location "${location}" already exists`);
                return;
            }

            const payload = { name, location };
            await callFirstAvailable(stationAPI, ['create', 'add', 'post'], payload);

            toast.success('Station created');
            setNewStation({ name: '', location: '' });
            setShowCreateStation(false);
            loadDashboardData();
        } catch (err) {
            console.error(err);

            const status = err?.response?.status;
            const serverMessage = err?.response?.data?.message || '';
            const code = err?.response?.data?.code;

            if (status === 409 || code?.startsWith('DUPLICATE')) {
                if (code === 'DUPLICATE_NAME' || /name.*exist/i.test(serverMessage)) {
                    toast.error('A station with this name already exists');
                    return;
                }
                if (code === 'DUPLICATE_LOCATION' || /location.*exist/i.test(serverMessage)) {
                    toast.error('A station with this location already exists');
                    return;
                }
                toast.error('Duplicate station detected. Please change the name or location.');
                return;
            }

            toast.error(serverMessage || err.message || 'Failed to create station');
        }
    };

    const handleUpdateStation = async (e) => {
        e.preventDefault();
        try {
            if (!editStation?.id) {
                toast.error('Missing station id');
                return;
            }
            const payload = {
                name: editStation.name?.trim(),
                location: editStation.location?.trim(),
            };
            await stationAPI.update(editStation.id, payload);
            toast.success('Station updated');
            setShowEditModal(false);
            setEditStation(null);
            loadDashboardData();
        } catch (err) {
            console.error(err);
            toast.error(err?.response?.data?.message ?? err.message ?? 'Failed to update station');
        }
    };

    const handleDownloadFiltered = async () => {
        if (isOperator) { deny(); return; }
        if (downloadingReport) return;

        setDownloadingReport(true);
        try {
            const res = await stationAPI.downloadReport({
                stationId: selectedStation || undefined,
                fromMonth,
                fromYear,
                toMonth,
                toYear,
                fromDate, // YYYY-MM-DD
                toDate,   // YYYY-MM-DD
            });

            const blob = new Blob([res.data], {
                type:
                    res.headers?.['content-type'] ||
                    res.headers?.get?.('content-type') ||
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = window.URL.createObjectURL(blob);

            let filename = `IncidentReport_${selectedStation || 'AllStations'}_${fromDate || `${fromYear}-${String(fromMonth).padStart(2, '0')}`}_to_${toDate || `${toYear}-${String(toMonth).padStart(2, '0')}`}.xlsx`;
            const cd =
                res.headers?.['content-disposition'] ||
                res.headers?.get?.('content-disposition');
            if (cd) {
                const match = /filename\*?=(?:UTF-8''|")?([^;"]+)/i.exec(cd);
                if (match?.[1]) {
                    filename = decodeURIComponent(match[1].replace(/"/g, '').trim());
                }
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Report downloaded');
        } catch (err) {
            console.error(err);
            toast.message('Server report unavailable, exporting CSV instead.');
            downloadCsv({
                incidents: filteredIncidents,
                selectedStation,
                fromMonth, fromYear, toMonth, toYear,
                fromDate, toDate,
            });
        } finally {
            setDownloadingReport(false);
        }
    };


    const handleDeleteStation = async (stationId) => {
        if (!stationId) return;
        if (!confirm('Delete this station? This action cannot be undone.')) return;
        try {
            setLoadingById(stationId, true);
            await stationAPI.delete(stationId);
            toast.success('Station deleted');
            await loadDashboardData();
        } catch (err) {
            console.error(err);
            const status = err?.response?.status;
            const serverMsg =
                err?.response?.data?.message ||
                (typeof err?.response?.data === 'string' ? err.response.data : undefined);

            if (status === 409) {
                toast.error(serverMsg || 'Station has historical events and cannot be deleted.');
            } else {
                toast.error(serverMsg || err?.message || 'Failed to delete station');
            }
        } finally {
            setLoadingById(stationId, false);
        }
    };

    const handleToggleStation = async (stationId) => {
        if (!stationId) return;
        try {
            setLoadingById(stationId, true);
            await stationAPI.toggleStatus(stationId);
            toast.success('Station status updated');
            await loadDashboardData();
        } catch (err) {
            console.error(err);
            const msg =
                err?.response?.data?.message ??
                (typeof err?.response?.data === 'string' ? err.response.data : undefined) ??
                err?.message ??
                'Failed to update station status';
            toast.error(msg || 'Station cannot be activated while incident is unresolved.');
        } finally {
            setLoadingById(stationId, false);
        }
    };

    const openIncidentCount = incidents.length;

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar onManageUsers={() => {
                const isAdmin = String(role || '').toLowerCase() === 'admin';
                if (!isAdmin) {
                    toast.error('Only admins can manage users.');
                    return;
                }
                setActiveTab('Users');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
                onChangePassword={handleChangePassword}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Safety Dashboard</h1>
                        <p className="text-gray-600 mt-1">Monitor and manage all stations and incidents</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6">
                    <Tabs
                        tabs={tabs}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        openIncidentCount={openIncidentCount}
                    />
                </div>

                {/* Global E-STOP banner */}
                {openIncidentCount > 0 && (
                    <EStopBanner count={openIncidentCount} onReview={() => setActiveTab('Incidents')} />
                )}

                {/* OVERVIEW TAB */}
                {activeTab === 'Overview' && (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <StatCard
                                title="Total Stations"
                                value={stats?.totalStations ?? 0}
                                icon={<MapPin className="w-12 h-12 text-blue-500 opacity-20" />}
                                color="border-blue-500"
                                Tooltip="Total Stations"
                            />
                            <StatCard
                                title="Open Incidents"
                                value={stats?.openIncidents ?? openIncidentCount ?? 0}
                                icon={<AlertCircle className="w-12 h-12 text-red-500 opacity-20" />}
                                color="border-red-500"
                                Tooltip="Open Incidents"
                            />
                            <StatCard
                                title="Acknowledged Incidents"
                                value={stats?.acknowledgedIncidents ?? 0}
                                icon={<CheckCircle className="w-12 h-12 text-yellow-500 opacity-20" />}
                                color="border-yellow-500"
                                Tooltip="Acknowledged Incidents"
                            />
                            <StatCard
                                title="Total Incidents"
                                value={stats?.totalIncidents ?? 0}
                                icon={<Activity className="w-12 h-12 text-purple-500 opacity-20" />}
                                color="border-purple-500"
                                Tooltip="Total Incidents"
                            />
                        </div>

                        {/* Quick Analytics Snapshot */}
                        {!isOperator && (
                            <>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xl font-bold text-gray-900 flex items-center">
                                                <BarChart3 className="w-6 h-6 text-blue-600 mr-2" />
                                                Incidents per Station (Last 30 days)
                                            </h3>
                                        </div>

                                        {(chartData?.incidentsByStation?.length ?? 0) > 0 ? (
                                            <div className="h-72">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ReBarChart data={chartData.incidentsByStation}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="stationName" interval={0} angle={-20} height={60} textAnchor="end" />
                                                        <YAxis allowDecimals={false} />
                                                        <Tooltip formatter={(value) => [`${value}`, 'Incidents']} />
                                                        <Legend />
                                                        <Bar dataKey="count" fill="#3B82F6" name="Incidents" />
                                                    </ReBarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No chart data available.</p>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-xl shadow-md p-6">
                                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                            <PieChart className="w-6 h-6 text-emerald-600 mr-2" />
                                            Incident Status Split (Overall)
                                        </h3>

                                        {[
                                            { status: 'Open', value: Number(stats?.openIncidents ?? 0) },
                                            { status: 'Acknowledged', value: Number(stats?.acknowledgedIncidents ?? 0) },
                                            { status: 'Closed', value: Number(stats?.closedIncidents ?? 0) },
                                        ].length ? (
                                            <div className="h-72">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RePieChart>
                                                        <Pie data={[
                                                            { status: 'Open', value: Number(stats?.openIncidents ?? 0) },
                                                            { status: 'Acknowledged', value: Number(stats?.acknowledgedIncidents ?? 0) },
                                                            { status: 'Closed', value: Number(stats?.closedIncidents ?? 0) },
                                                        ]} dataKey="value" nameKey="status" label>
                                                            {[0, 1, 2].map((index) => (
                                                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip />
                                                        <Legend />
                                                    </RePieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No status split data available.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Recent Incidents */}
                        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <TrendingUp className="w-6 h-6 text-purple-600 mr-2" />
                                Recent Incidents
                            </h3>
                            <RecentIncidentsTable
                                recentIncidents={recentIncidents}
                                formatDateTime={(d) => formatDateTime(d, dateTimeFmt)}
                                resolveStationName={resolveStationName}
                                resolveStationLocation={resolveStationLocation}
                            />
                        </div>

                        {/* Stations (Overview as Cards) */}
                        {String(role || '').toLowerCase() === "admin" && (
                            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center">
                                        <MapPin className="w-6 h-6 text-blue-600 mr-2" />
                                        Stations
                                    </h3>

                                    <button
                                        onClick={() => setShowCreateStation(true)}
                                        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Create Station</span>
                                    </button>
                                </div>

                                {/* Create Station */}
                                {showCreateStation && (
                                    <CreateStationForm
                                        newStation={newStation}
                                        setNewStation={setNewStation}
                                        onCancel={() => setShowCreateStation(false)}
                                        onSubmit={handleCreateStation}
                                    />
                                )}

                                {Array.isArray(stations) && stations.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                                        <p className="text-lg">No stations found. Use “Create Station” to add one.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                                        {(stations || []).map((s) => {
                                            const isActive = Boolean(s?.isActive ?? s?.IsActive ?? true);
                                            const latestLower = String(s?.latestIncidentStatus || '').toLowerCase();
                                            const isWaitingForAck = latestLower === 'open';

                                            return (
                                                <div
                                                    key={s.id ?? `${s.name}-${s.location}-${Math.random()}`}
                                                    className="rounded-xl border bg-white shadow-sm p-4 flex flex-col justify-between"
                                                >
                                                    {/* Header: name + status + actions */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-semibold text-gray-900 truncate">
                                                                    {s?.name || '—'}
                                                                </h4>

                                                                {/* Events badge */}
                                                                <span
                                                                    className={
                                                                        'shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full ' +
                                                                        ((s?.incidentCount ?? 0) === 0
                                                                            ? 'bg-emerald-100 text-emerald-800'
                                                                            : 'bg-gray-200 text-gray-700')
                                                                    }
                                                                    title={
                                                                        (s?.incidentCount ?? 0) === 0
                                                                            ? 'No historical events'
                                                                            : 'Has historical events'
                                                                    }
                                                                >
                                                                    {(s?.incidentCount ?? 0)} events
                                                                </span>

                                                                {/* IsActive badge */}
                                                                <span
                                                                    className={[
                                                                        'shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full',
                                                                        (Boolean(s?.isActive ?? s?.IsActive)
                                                                            ? 'bg-green-100 text-green-700'
                                                                            : 'bg-gray-200 text-gray-600'),
                                                                    ].join(' ')}
                                                                    title={Boolean(s?.isActive ?? s?.IsActive) ? 'Station is active' : 'Station is inactive'}
                                                                >
                                                                    {Boolean(s?.isActive ?? s?.IsActive) ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </div>

                                                            <div className="mt-1 flex items-center text-sm text-gray-600">
                                                                <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                                                                <span className="truncate">{s?.location || '—'}</span>
                                                            </div>
                                                        </div>

                                                        {/* Icon-only actions */}
                                                        <div className="flex items-center gap-1">
                                                            {String(role || '').toLowerCase() === 'admin' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditStation({ ...s });
                                                                        setShowEditModal(true);
                                                                    }}
                                                                    className="p-2 rounded-md border hover:bg-gray-50 disabled:opacity-50"
                                                                    title="Edit"
                                                                    aria-label="Edit station"
                                                                    disabled={stationLoading[s.id]}
                                                                >
                                                                    <Pencil className="w-4 h-4 text-gray-700" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Toggle button */}
                                                    <div className="mt-3">
                                                        {String(role || '').toLowerCase() === 'admin' && (
                                                            <button
                                                                onClick={() => handleToggleStation(s.id)}
                                                                className={`text-xs px-2 py-1 rounded-md border ${isWaitingForAck
                                                                        ? 'border-red-200 text-red-700 bg-red-50 cursor-not-allowed'
                                                                        : isActive
                                                                            ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                                                    }`}
                                                                disabled={stationLoading[s.id] || isWaitingForAck}
                                                                title={isWaitingForAck ? 'Waiting for Ack' : undefined}
                                                            >
                                                                {isWaitingForAck ? 'Waiting for Ack' : (isActive ? 'Deactivate' : 'Activate')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* INCIDENTS TAB */}
                {activeTab === 'Incidents' && (
                    <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                            <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
                            Active Incidents
                        </h3>
                        <IncidentsList
                            incidents={incidents}
                            formatDateTime={(d) => formatDateTime(d, dateTimeFmt)}
                            onAcknowledge={handleAcknowledge}
                            onClose={handleClose}
                        />
                    </div>
                )}

                {/* REPORTS TAB */}
                {activeTab === 'Reports' && (
                    <>
                        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <Calendar className="w-6 h-6 text-indigo-600 mr-2" />
                                Reports & Analytics
                            </h3>

                            
                            <ReportsFilters
                                stations={stations}
                                selectedStation={selectedStation}
                                setSelectedStation={setSelectedStation}

                                
                                fromDate={fromDate}
                                setFromDate={setFromDate}
                                toDate={toDate}
                                setToDate={setToDate}

                               
                                fromMonth={fromMonth}
                                setFromMonth={setFromMonth}
                                fromYear={fromYear}
                                setFromYear={setFromYear}
                                toMonth={toMonth}
                                setToMonth={setToMonth}
                                toYear={toYear}
                                setToYear={setToYear}

                                onDownload={handleDownloadFiltered}
                                loading={reportsLoading}
                                downloading={downloadingReport}
                            />

                           
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <IncidentsByDayChart data={chartLocal.incidentsByDay} />
                                <IncidentsByStationChart data={chartLocal.incidentsByStation} />
                                <StatusPieChart data={chartLocal.statusSplit} />
                                <TopStationsChart data={topStationsGlobal} />
                            </div>
                        </div>
                    </>
                )}

                {/* USERS TAB (Admin only) */}
                {activeTab === "Users" && String(role || '').toLowerCase() === "admin" && (
                    <div className="rounded-2xl bg-white p-8 shadow-xl border border-gray-100">
                        <button
                            onClick={() => setActiveTab("Overview")}
                            className="px-3 py-1.5 rounded-lg border bg-blue-50 hover:bg-gray-100 transition text-sm"
                        >
                            ← Back
                        </button>

                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div>
                                    <br />
                                    <h2 className="text-3xl font-semibold text-blue-900 flex items-center gap-2">
                                        User Management
                                    </h2>
                                    <p className="text-gray-500 text-sm mt-1">
                                        Manage users, roles & permissions. <span className="text-red-500">Admins cannot delete other Admins.</span>
                                    </p>
                                </div>
                            </div>
                            {usersLoading && (
                                <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
                            )}
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    placeholder="Search by name or email…"
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center gap-3">
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="px-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Roles</option>
                                    <option value="Operator">Operator</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="flex items-center justify-between mb-4 text-gray-600 text-sm">
                            <span>
                                Showing <strong>{filteredUsers.length}</strong> of {users.length} users
                            </span>
                            <span className="hidden md:inline text-gray-400">
                                Tip: Use search to quickly find users.
                            </span>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                            <table className="min-w-full text-sm">
                                <thead>
                                    <tr className="bg-green-100 border-b">
                                        <th className="py-3 pl-5 text-left font-medium text-gray-700">Name</th>
                                        <th className="py-3 text-left font-medium text-gray-700">Email</th>
                                        <th className="py-3 text-left font-medium text-gray-700">Role</th>
                                        <th className="py-3 pr-5 text-right font-medium text-gray-700">Actions</th>
                                    </tr>
                                </thead>

                                {usersLoading ? (
                                    <tbody>
                                        {Array.from({ length: 6 }).map((_, i) => (
                                            <tr key={i} className="border-t">
                                                <td className="py-4 pl-5">
                                                    <div className="h-4 w-28 bg-gray-200 animate-pulse rounded"></div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="h-4 w-48 bg-gray-200 animate-pulse rounded"></div>
                                                </td>
                                                <td className="py-4">
                                                    <div className="h-5 w-16 bg-gray-200 animate-pulse rounded-full"></div>
                                                </td>
                                                <td className="py-4 pr-5 text-right">
                                                    <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                ) : filteredUsers.length > 0 ? (
                                    <tbody>
                                        {filteredUsers.map((u) => (
                                            <tr
                                                key={u.id}
                                                className="border-t hover:bg-gray-50 transition"
                                            >
                                                <td className="py-4 pl-5 font-medium text-gray-900">{u.fullName}</td>
                                                <td className="py-4 text-gray-700">{u.email}</td>
                                                <td className="py-4">
                                                    <span
                                                        className={
                                                            "px-2 py-1 rounded-full text-xs font-semibold " +
                                                            (u.role === "Admin"
                                                                ? "bg-purple-100 text-purple-800"
                                                                : u.role === "Supervisor"
                                                                    ? "bg-amber-100 text-amber-800"
                                                                    : "bg-blue-100 text-blue-800")
                                                        }
                                                    >
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="py-4 pr-5 text-right">
                                                    <button
                                                        disabled={u.role === "Admin"}
                                                        onClick={() => handleDeleteUser(u.id, u.role)}
                                                        className={
                                                            "px-3 py-1.5 rounded-md text-sm border transition " +
                                                            (u.role === "Admin"
                                                                ? "opacity-40 cursor-not-allowed"
                                                                : "hover:bg-red-50 hover:border-red-400 text-red-600")
                                                        }
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                ) : (
                                    <tbody>
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="p-4 bg-gray-100 rounded-full">
                                                        <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path d="M4 13s-1 0-1 1 1 4 7 4 7-3 7-4-1-1-1-1H4z" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-gray-600">No users match your filters.</p>

                                                    <button
                                                        onClick={() => {
                                                            setUserSearch("");
                                                            setRoleFilter("");
                                                        }}
                                                        className="px-3 py-1.5 rounded-md border hover:bg-gray-50 transition text-sm"
                                                    >
                                                        Clear filters
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                )}
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Station Modal */}
            {showEditModal && editStation && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Edit Station</h3>
                        <form onSubmit={handleUpdateStation} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Station Name</label>
                                <input
                                    type="text"
                                    value={editStation.name}
                                    onChange={(e) => setEditStation({ ...editStation, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={editStation.location || ''}
                                    onChange={(e) => setEditStation({ ...editStation, location: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg"
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditStation(null);
                                    }}
                                    className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Acknowledge Incident Modal */}
            {showAckForm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold mb-4">Acknowledge Incident</h3>

                        <form onSubmit={handleSubmitAcknowledge} className="space-y-5">
                            {/* Issue (required) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Issue was about? <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={ackForm.issue}
                                    onChange={(e) => setAckForm((p) => ({ ...p, issue: e.target.value }))}
                                    placeholder="e.g., Conveyor jam at Station 3"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {/* Comment (optional) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Comment <span className="text-gray-400">(optional)</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={ackForm.comment}
                                    onChange={(e) => setAckForm((p) => ({ ...p, comment: e.target.value }))}
                                    placeholder="Add any context about this incident..."
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowAckForm(false); setAckIncidentId(null); }}
                                    className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                                    disabled={submittingAck}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                                    disabled={submittingAck}
                                >
                                    {submittingAck ? 'Saving…' : 'Acknowledge'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Close Incident Modal (resolved must be yes) */}
            {/* Close Incident Modal */}
            {showCloseForm && (
                <div
                    className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
                    role="dialog"
                    aria-modal="true"
                    onClick={() => {
                        // clicking the backdrop closes the modal
                        setShowCloseForm(false);
                        setCloseIncidentId(null);
                    }}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
                        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
                    >
                        <h3 className="text-xl font-bold mb-4">Close Incident</h3>

                        <form onSubmit={handleSubmitClose} className="space-y-5">
                            {/* Closing Comment (optional) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Closing Comment <span className="text-gray-400">(optional)</span>
                                </label>
                                <textarea
                                    rows={4}
                                    value={closeForm.comment}
                                    onChange={(e) => setCloseForm((p) => ({ ...p, comment: e.target.value }))}
                                    placeholder="Add closing notes or actions taken..."
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCloseForm(false);
                                        setCloseIncidentId(null);
                                    }}
                                    className="px-4 py-2 rounded-lg border hover:bg-gray-50"
                                    disabled={submittingClose}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                                    disabled={submittingClose}
                                >
                                    {submittingClose ? 'Saving…' : 'Close Incident'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AdminDashboard;
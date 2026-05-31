/**
 * Field Data Entry — root screen
 *
 * FIELD users        → Department dashboard (select dept → fill forms)
 * OWNER / MANAGER / SUPER_ADMIN → Summary view (stats + CSV download)
 *
 * Note: This component is rendered both:
 * 1. As a tab in (tabs)/feedback.jsx (no back button handling needed)
 * 2. Directly via navigation from root (back button handling needed)
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors, Spacing, Typography, Radius, Shadows } from '../../constants/theme';
import { activityTypesAPI, feedbackAPI } from '../../services/api';
import { useOfflineQueue } from '../../hooks/useFeedback';
import { useAuth } from '../../services/authStore';

// ─── Department config ────────────────────────────────────────────────────────

const DEPT_CONFIG = {
  Marketing: {
    emoji: '📢',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.3)',
    desc: 'Campaigns, meetings, dealer visits',
  },
  Production: {
    emoji: '🌾',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
    desc: 'Seed distribution, field visits, harvesting',
  },
  'R&D': {
    emoji: '🔬',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    desc: 'Nursery, trials, GOT, threshing',
  },
  Processing: {
    emoji: '⚙️',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    desc: 'Licensing, intake, processing register',
  },
};

const MANAGEMENT_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER'];

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Escape a single CSV cell value.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSVCell(value) {
  const str = value == null ? '' : String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

/**
 * Convert an array of submission objects (FarmerFeedbackListOut) to a CSV string.
 * Returns an empty string when there are no rows.
 */
function jsonToCSV(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const headers = [
    'ID', 'Activity Type ID', 'Farmer Name', 'Farmer Phone',
    'Village', 'Status', 'Submitted At',
  ];
  const lines = [headers.join(',')];

  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.activity_type_id,
        escapeCSVCell(row.farmer_name),
        escapeCSVCell(row.farmer_phone),
        escapeCSVCell(row.village),
        escapeCSVCell(row.status),
        escapeCSVCell(row.submitted_at),
      ].join(','),
    );
  }

  // UTF-8 BOM prefix so Excel opens Indian characters correctly
  return '﻿' + lines.join('\n');
}

// ─── DepartmentCard (FIELD view) ──────────────────────────────────────────────

const DepartmentCard = memo(function DepartmentCard({ dept, onPress }) {
  const cfg = DEPT_CONFIG[dept.name] || {
    emoji: '📋',
    color: Colors.primary,
    bg: Colors.primaryMuted,
    border: 'rgba(34,197,94,0.3)',
    desc: '',
  };

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: cfg.border, backgroundColor: cfg.bg }]}
      onPress={() => onPress(dept.name)}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <View style={[styles.emojiWrap, { backgroundColor: cfg.bg }]}>
          <Text style={styles.emoji}>{cfg.emoji}</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: cfg.color }]}>
          <Text style={styles.countText}>{dept.activity_count}</Text>
          <Text style={styles.countLabel}> activities</Text>
        </View>
      </View>
      <Text style={[styles.deptName, { color: cfg.color }]}>{dept.name}</Text>
      <Text style={styles.deptDesc} numberOfLines={2}>
        {cfg.desc || 'Field data collection activities'}
      </Text>
      <View style={[styles.cardArrow, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.cardArrowText, { color: cfg.color }]}>View Activities →</Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── FIELD view — Department Dashboard ───────────────────────────────────────

function FieldView({ user, queueCount, sync, syncing }) {
  const router = useRouter();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const fetchDepts = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [deptRes, actRes] = await Promise.all([
        activityTypesAPI.departments(),
        activityTypesAPI.list(),
      ]);

      // Deduplicate activities by name per department to get true counts
      const seenByDept = {};
      for (const a of (actRes.data || [])) {
        if (!seenByDept[a.department]) seenByDept[a.department] = new Set();
        seenByDept[a.department].add(a.name);
      }

      const depts = (deptRes.data || []).map((d) => ({
        ...d,
        activity_count: seenByDept[d.name]?.size ?? d.activity_count,
      }));
      setDepartments(depts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  const handlePress = useCallback(
    (deptName) => router.push(`/feedback/activities?dept=${encodeURIComponent(deptName)}`),
    [router],
  );

  const handleDownloadCSV = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await feedbackAPI.exportCSV(true); // field users always get today only
      const csvContent = jsonToCSV(res.data);
      if (!csvContent || csvContent.trim().split('\n').length <= 1) {
        Alert.alert('No Data', "You haven't submitted any feedback forms today.");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `my_field_data_${today}.csv`;
      const fileUri = (FileSystem.documentDirectory || '') + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `My Field Data — ${today}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Saved', `CSV saved to:\n${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Download Failed', err.message || 'Could not download CSV.');
    } finally {
      setDownloading(false);
    }
  }, []);

  const renderItem = useCallback(
    ({ item }) => <DepartmentCard dept={item} onPress={handlePress} />,
    [handlePress],
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Field Data Entry</Text>
          <Text style={styles.subtitle}>Select department to begin</Text>
        </View>
        <View style={styles.headerActions}>
          {queueCount > 0 && (
            <TouchableOpacity style={styles.syncChip} onPress={sync} disabled={syncing}>
              <Text style={styles.syncChipText}>
                {syncing ? 'Syncing…' : `${queueCount} pending`}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.csvBtn, downloading && styles.csvBtnDisabled]}
            onPress={handleDownloadCSV}
            disabled={downloading}
            activeOpacity={0.75}
          >
            <Text style={styles.csvBtnText}>{downloading ? '...' : 'CSV'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Agent strip */}
      {user?.name && (
        <View style={styles.agentStrip}>
          <Text style={styles.agentText}>👤 {user.name}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading departments…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchDepts()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={departments}
          keyExtractor={(d) => d.name}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDepts(true); }}
              tintColor={Colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── MANAGEMENT view — Summary Dashboard ─────────────────────────────────────

function ManagementView({ user }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // null | 'all' | 'today'
  const [downloading, setDownloading] = useState(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await feedbackAPI.getStats();
      setStats(res.data);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleDownloadCSV = useCallback(async (todayOnly) => {
    const key = todayOnly ? 'today' : 'all';
    setDownloading(key);
    try {
      const res = await feedbackAPI.exportCSV(todayOnly);
      const csvContent = jsonToCSV(res.data);
      if (!csvContent || csvContent.trim().split('\n').length <= 1) {
        Alert.alert('No Data', todayOnly
          ? "No submissions found for today."
          : "No submissions found.");
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const fileName = todayOnly
        ? `field_data_today_${today}.csv`
        : `field_data_all_${today}.csv`;
      const fileUri = (FileSystem.documentDirectory || '') + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: todayOnly ? `Today's Field Data — ${today}` : `All Field Data — ${today}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Saved', `CSV saved to:\n${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Download Failed', err.message || 'Could not download CSV.');
    } finally {
      setDownloading(null);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Field Data Overview</Text>
          <Text style={styles.subtitle}>All submissions across your team</Text>
        </View>
      </View>

      {user?.name && (
        <View style={styles.agentStrip}>
          <Text style={styles.agentText}>👤 {user.name}</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchStats(true); }}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Stat cards — independent loading/error, never blocks downloads */}
        {statsLoading ? (
          <View style={[styles.statsRow, { justifyContent: 'center', paddingVertical: Spacing.xl }]}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        ) : statsError ? (
          <View style={[styles.statsRow, { justifyContent: 'center', paddingVertical: Spacing.md }]}>
            <TouchableOpacity onPress={() => fetchStats()}>
              <Text style={{ color: Colors.textMuted, fontSize: Typography.sm }}>
                ⚠ Could not load stats · tap to retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderColor: 'rgba(34,197,94,0.3)', backgroundColor: 'rgba(34,197,94,0.08)' }]}>
              <Text style={styles.statEmoji}>📋</Text>
              <Text style={[styles.statNumber, { color: '#22c55e' }]}>
                {stats?.total_all_time ?? '—'}
              </Text>
              <Text style={styles.statLabel}>Total Submissions</Text>
              <Text style={styles.statSub}>All time</Text>
            </View>

            <View style={[styles.statCard, { borderColor: 'rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.08)' }]}>
              <Text style={styles.statEmoji}>📅</Text>
              <Text style={[styles.statNumber, { color: '#3b82f6' }]}>
                {stats?.total_today ?? '—'}
              </Text>
              <Text style={styles.statLabel}>Today's Submissions</Text>
              <Text style={styles.statSub}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
            </View>
          </View>
        )}

        {/* Download All Data card — always visible */}
        <TouchableOpacity
          style={[styles.downloadCard, downloading === 'all' && styles.downloadCardDisabled]}
          onPress={() => handleDownloadCSV(false)}
          disabled={downloading !== null}
          activeOpacity={0.8}
        >
          <View style={styles.downloadCardLeft}>
            <Text style={styles.downloadIcon}>📥</Text>
            <View>
              <Text style={styles.downloadTitle}>Download All Data</Text>
              <Text style={styles.downloadSub}>
                {stats?.total_all_time
                  ? `${stats.total_all_time} record${stats.total_all_time !== 1 ? 's' : ''} · CSV format`
                  : 'All submissions · CSV format'}
              </Text>
            </View>
          </View>
          {downloading === 'all' ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <Text style={styles.downloadArrow}>→</Text>
          )}
        </TouchableOpacity>

        {/* Download Today's Data card — always visible */}
        <TouchableOpacity
          style={[styles.downloadCard, { borderColor: 'rgba(59,130,246,0.3)', backgroundColor: 'rgba(59,130,246,0.05)' }, downloading === 'today' && styles.downloadCardDisabled]}
          onPress={() => handleDownloadCSV(true)}
          disabled={downloading !== null}
          activeOpacity={0.8}
        >
          <View style={styles.downloadCardLeft}>
            <Text style={styles.downloadIcon}>📅</Text>
            <View>
              <Text style={styles.downloadTitle}>Download Today's Data</Text>
              <Text style={styles.downloadSub}>
                {stats?.total_today
                  ? `${stats.total_today} record${stats.total_today !== 1 ? 's' : ''} today · CSV format`
                  : "Today's submissions · CSV format"}
              </Text>
            </View>
          </View>
          {downloading === 'today' ? (
            <ActivityIndicator color="#3b82f6" size="small" />
          ) : (
            <Text style={[styles.downloadArrow, { color: '#3b82f6' }]}>→</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.infoNote}>
          Field agents fill in forms under their department tabs.{'\n'}
          Download all submissions or just today's data above.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Root screen — role selector + back-button fix ────────────────────────────

export default function FeedbackRootScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { queueCount, sync, syncing, refreshCount } = useOfflineQueue();

  const role = user?.role?.toUpperCase?.() || '';
  const isManagement = MANAGEMENT_ROLES.includes(role);

  // Register back handler for Android - when navigated directly from root
  // When rendered as a tab, the tabs navigator handles back button
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        router.replace('/(tabs)');
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [router]),
  );

  useEffect(() => {
    if (!isManagement) refreshCount();
  }, [isManagement, refreshCount]);

  if (isManagement) {
    return <ManagementView user={user} />;
  }

  return (
    <FieldView
      user={user}
      queueCount={queueCount}
      sync={sync}
      syncing={syncing}
    />
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncChip: {
    backgroundColor: Colors.warningMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  syncChipText: {
    fontSize: Typography.xs,
    color: Colors.warning,
    fontWeight: Typography.semibold,
  },
  csvBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  csvBtnDisabled: { opacity: 0.5 },
  csvBtnText: {
    fontSize: Typography.xs,
    color: Colors.textInverse,
    fontWeight: Typography.bold,
  },
  agentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  agentText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },

  // FIELD — list
  list: {
    padding: Spacing.base,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    ...Shadows.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  emojiWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26 },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  countText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: '#fff',
  },
  countLabel: {
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.8)',
  },
  deptName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    marginBottom: 4,
  },
  deptDesc: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  cardArrow: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  cardArrowText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },

  // MANAGEMENT — stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statEmoji: { fontSize: 28, marginBottom: Spacing.xs },
  statNumber: {
    fontSize: 36,
    fontWeight: Typography.extrabold,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginTop: 4,
    textAlign: 'center',
  },
  statSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // MANAGEMENT — download card
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
    ...Shadows.sm,
  },
  downloadCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  downloadIcon: { fontSize: 28 },
  downloadTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  downloadSub: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  downloadArrow: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: Typography.bold,
  },
  downloadCardDisabled: {
    opacity: 0.5,
  },

  infoNote: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    fontSize: Typography.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Shared states
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.base,
  },
  loadingText: { color: Colors.textMuted, fontSize: Typography.sm },
  errorIcon: { fontSize: 40 },
  errorText: {
    color: Colors.textSecondary,
    fontSize: Typography.base,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  retryText: {
    color: Colors.textInverse,
    fontWeight: Typography.bold,
    fontSize: Typography.base,
  },
});

/**
 * Profile Screen
 * Shows user info, role, settings, and logout
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../services/authStore';
import NavigationReady from '../../services/navigationReady';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { USER_ROLES } from '../../constants';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notifEnabled, setNotifEnabled] = useState(true);

  function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            NavigationReady.whenReady(() => {
              router.replace('/(auth)/login');
            });
          },
        },
      ],
    );
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const roleColor = {
    OWNER: Colors.warning,
    MANAGER: Colors.info,
    FIELD: Colors.primary,
    ACCOUNTS: Colors.textSecondary,
  }[user?.role] || Colors.primary;

  // Safe rgba backgrounds for role badge (8-digit hex not supported on all Android versions)
  const roleBadgeBg = {
    OWNER: 'rgba(245, 158, 11, 0.15)',
    MANAGER: 'rgba(59, 130, 246, 0.15)',
    FIELD: 'rgba(34, 197, 94, 0.15)',
    ACCOUNTS: 'rgba(148, 163, 184, 0.15)',
  }[user?.role] || 'rgba(34, 197, 94, 0.15)';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.base, paddingBottom: insets.bottom + 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <LinearGradient
          colors={[Colors.primaryDark, Colors.primary]}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
        <Text style={styles.userName}>{user?.name || 'User'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleBadgeBg }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>
            {USER_ROLES[user?.role] || user?.role}
          </Text>
        </View>
        {user?.mobile ? (
          <Text style={styles.mobile}>📱 +91 {user.mobile}</Text>
        ) : null}
      </View>

      {/* Info card */}
      <Card style={styles.infoCard}>
        <Text style={styles.cardTitle}>Account Info</Text>
        <InfoRow label="Name" value={user?.name} />
        {user?.mobile ? <InfoRow label="Mobile" value={`+91 ${user.mobile}`} /> : null}
        <InfoRow label="Role" value={USER_ROLES[user?.role] || user?.role} />
        <InfoRow label="User ID" value={user?.id?.slice(0, 8) + '...'} />
      </Card>

      {/* Settings */}
      <Card style={styles.settingsCard}>
        <Text style={styles.cardTitle}>Settings</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Text style={styles.settingDesc}>Receive task and attendance alerts</Text>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={setNotifEnabled}
            trackColor={{ false: Colors.secondary, true: Colors.primaryMuted }}
            thumbColor={notifEnabled ? Colors.primary : Colors.textMuted}
          />
        </View>
      </Card>

      {/* App info */}
      <Card style={styles.appCard}>
        <Text style={styles.cardTitle}>About</Text>
        <InfoRow label="App" value="AgriTask Mobile" />
        <InfoRow label="Version" value="1.0.0" />
        <InfoRow label="Backend" value="PGA AgriTask API v1.0" />
      </Card>

      {/* Logout */}
      <Button
        title="Sign Out"
        onPress={handleLogout}
        variant="danger"
        fullWidth
        size="lg"
        style={styles.logoutBtn}
      />
    </ScrollView>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  label: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  value: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.md,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.base,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: Typography.xxl,
    fontWeight: Typography.extrabold,
    color: '#fff',
  },
  userName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  roleText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  mobile: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
  },
  infoCard: {
    marginBottom: Spacing.md,
  },
  settingsCard: {
    marginBottom: Spacing.md,
  },
  appCard: {
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  settingLabel: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  settingDesc: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: Spacing.sm,
  },
});

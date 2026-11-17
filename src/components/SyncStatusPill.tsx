/**
 * SyncStatusPill — shows whether this device is online and how many changes
 * are waiting to sync. Tap it to sync now or to see changes that failed.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT } from '../config/theme';
import {
  subscribeSync, syncNow, getOutbox, discardOp, retryOp, onSynced, startAutoSync,
  type SyncState, type OutboxOp,
} from '../services/offline/offlineStore';
import { DATA_MODE } from '../services/firebase/firestoreService';

const timeAgo = (ts: number) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
};

export default function SyncStatusPill({ onSynced: onSyncedCb, compact }: { onSynced?: () => void; compact?: boolean }) {
  const [s, setS] = useState<SyncState | null>(null);
  const [open, setOpen] = useState(false);
  const [ops, setOps] = useState<OutboxOp[]>([]);

  useEffect(() => {
    if (DATA_MODE === 'SUPABASE') startAutoSync();
    return subscribeSync(setS);
  }, []);

  useEffect(() => (onSyncedCb ? onSynced(onSyncedCb) : undefined), [onSyncedCb]);

  useEffect(() => {
    if (open) getOutbox().then(setOps);
  }, [open, s]);

  if (DATA_MODE !== 'SUPABASE' || !s) return null;

  let bg = COLORS.SUCCESS;
  let label = 'Online · all saved';
  if (s.syncing) { bg = COLORS.INFO; label = 'Syncing…'; }
  else if (s.failed > 0) { bg = COLORS.ERROR; label = `${s.failed} change${s.failed > 1 ? 's' : ''} need attention`; }
  else if (!s.online) { bg = COLORS.ACCENT; label = s.pending > 0 ? `Offline · ${s.pending} waiting to sync` : 'Offline · using saved data'; }
  else if (s.pending > 0) { bg = COLORS.INFO; label = `${s.pending} waiting to sync`; }

  const onPress = () => {
    if (s.failed > 0 || s.pending > 0 || !s.online) setOpen(true);
    else syncNow();
  };

  return (
    <>
      <TouchableOpacity
        onPress={onPress}
        style={[styles.pill, { backgroundColor: bg }, compact && styles.pillCompact]}
        accessibilityRole="button"
        accessibilityLabel={`Sync status: ${label}`}
      >
        {s.syncing ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} /> : <View style={styles.dot} />}
        <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Sync</Text>
            <Text style={styles.sub}>
              {s.online ? 'Connected to the cloud.' : 'No connection. Bills and purchases are saved on this device and will upload automatically.'}
              {s.lastSyncAt ? ` Last upload ${timeAgo(s.lastSyncAt)}.` : ''}
            </Text>

            <ScrollView style={{ maxHeight: 320 }}>
              {ops.length === 0 && <Text style={styles.empty}>Nothing waiting. Everything is saved in the cloud.</Text>}
              {ops.map(op => (
                <View key={op.id} style={[styles.opRow, op.status === 'failed' && styles.opFailed]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.opLabel}>{op.label}</Text>
                    <Text style={styles.opMeta}>
                      {op.status === 'failed' ? `Not saved: ${op.error}` : `Waiting · ${timeAgo(op.createdAt)}`}
                    </Text>
                  </View>
                  {op.status === 'failed' && (
                    <View style={styles.opBtns}>
                      <TouchableOpacity style={styles.smallBtn} onPress={() => retryOp(op.id)}>
                        <Text style={styles.smallBtnText}>Retry</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => discardOp(op.id).then(() => getOutbox().then(setOps))}>
                        <Text style={[styles.smallBtnText, { color: COLORS.ERROR }]}>Discard</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setOpen(false)}>
                <Text style={[styles.btnText, { color: COLORS.TEXT_BODY }]}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => syncNow()} disabled={s.syncing}>
                <Text style={styles.btnText}>{s.syncing ? 'Syncing…' : 'Sync now'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.PILL, alignSelf: 'flex-start', maxWidth: 260 },
  pillCompact: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 },
  pillText: { color: '#fff', fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.BOLD },
  overlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'center', padding: SPACING.LG },
  sheet: { backgroundColor: COLORS.WHITE, borderRadius: RADIUS.XL, padding: SPACING.LG, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontSize: FONT_SIZE.XL, fontWeight: FONT_WEIGHT.EXTRABOLD, color: COLORS.TEXT_HEADING },
  sub: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_DIM, marginTop: 4, marginBottom: SPACING.MD, lineHeight: 18 },
  empty: { fontSize: FONT_SIZE.SM, color: COLORS.TEXT_DIM, textAlign: 'center', paddingVertical: SPACING.LG },
  opRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.SM, borderBottomWidth: 1, borderBottomColor: COLORS.DIVIDER, gap: SPACING.SM },
  opFailed: { backgroundColor: COLORS.ERROR_BG, borderRadius: RADIUS.MD, paddingHorizontal: SPACING.SM },
  opLabel: { fontSize: FONT_SIZE.SM, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.TEXT_HEADING },
  opMeta: { fontSize: FONT_SIZE.XS, color: COLORS.TEXT_DIM, marginTop: 2 },
  opBtns: { flexDirection: 'row', gap: 6 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.SM, backgroundColor: COLORS.PRIMARY_BG },
  smallBtnDanger: { backgroundColor: COLORS.WHITE, borderWidth: 1, borderColor: COLORS.ERROR },
  smallBtnText: { fontSize: FONT_SIZE.XS, fontWeight: FONT_WEIGHT.BOLD, color: COLORS.PRIMARY },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.SM, marginTop: SPACING.MD },
  btn: { backgroundColor: COLORS.PRIMARY, paddingHorizontal: SPACING.LG, paddingVertical: SPACING.SM + 2, borderRadius: RADIUS.MD },
  btnGhost: { backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER },
  btnText: { color: '#fff', fontWeight: FONT_WEIGHT.BOLD, fontSize: FONT_SIZE.SM },
});

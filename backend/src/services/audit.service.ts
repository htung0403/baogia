import { supabaseAdmin } from '../utils/supabase.js';
import { AuditAction, EntityType } from '../types/database.js';

/**
 * Audit Log Service
 * Records all admin actions for accountability.
 * Uses service_role key to bypass RLS.
 */
export class AuditService {
  /**
   * Log an action
   */
  static async log(params: {
    actorId: string;
    action: AuditAction;
    entityType: EntityType;
    entityId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from('audit_logs').insert({
        actor_id: params.actorId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        old_data: params.oldData ?? null,
        new_data: params.newData ?? null,
        ip_address: params.ipAddress ?? null,
      });

      if (error) {
        // Don't throw - audit logging should never break the main flow
        console.error('[AUDIT] Failed to log action:', error.message);
      }
    } catch (err) {
      console.error('[AUDIT] Unexpected error:', err);
    }
  }

  /**
   * Get audit logs with filtering
   */
  static async getLogs(params: {
    entityType?: EntityType;
    entityId?: string;
    actorId?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseAdmin
      .from('audit_logs')
      .select('*, profiles:actor_id(display_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.entityType) query = query.eq('entity_type', params.entityType);
    if (params.entityId) query = query.eq('entity_id', params.entityId);
    if (params.actorId) query = query.eq('actor_id', params.actorId);
    if (params.action) query = query.eq('action', params.action);

    query = query.range(
      params.offset ?? 0,
      (params.offset ?? 0) + (params.limit ?? 20) - 1
    );

    const { data, error, count } = await query;

    if (error) throw error;
    return { data, total: count ?? 0 };
  }
}

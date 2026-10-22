import { useState, useEffect, useCallback } from 'react';
import { approvalService } from '../services/domainServices';

const STORAGE_KEY = 'discount_policy';
const DEFAULT_MAX = 20;

export function useDiscountPolicy() {
  const [maxDiscountPct, setMaxDiscountPct] = useState(DEFAULT_MAX);
  const [approverRole, setApproverRole] = useState('sales_manager');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Try backend first
    approvalService.getDiscountPolicy()
      .then((res) => {
        if (!active) return;
        const pct = parseFloat(res?.max_discount_pct ?? res?.maxDiscountPct);
        if (Number.isFinite(pct)) setMaxDiscountPct(pct);
        if (res?.approver_role_code || res?.approverRole) setApproverRole(res.approver_role_code || res.approverRole);
      })
      .catch(() => {
        // Fallback: localStorage
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          if (Number.isFinite(saved.maxDiscountPct)) setMaxDiscountPct(saved.maxDiscountPct);
          if (saved.approverRole) setApproverRole(saved.approverRole);
        } catch {}
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const savePolicy = useCallback(async (pct, role = 'sales_manager') => {
    const numPct = parseFloat(pct);
    if (!Number.isFinite(numPct) || numPct < 0 || numPct > 100) throw new Error('Invalid discount threshold');
    // Try backend
    try {
      await approvalService.updateDiscountPolicy({ max_discount_pct: numPct, approver_role_code: role });
    } catch {}
    // Always persist locally
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ maxDiscountPct: numPct, approverRole: role, updatedAt: new Date().toISOString() }));
    setMaxDiscountPct(numPct);
    setApproverRole(role);
  }, []);

  return { maxDiscountPct, approverRole, loading, error, savePolicy };
}

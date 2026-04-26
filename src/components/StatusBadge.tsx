export default function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    DRAFT: { cls: 'badge-neutral', label: 'Draft' },
    SENT: { cls: 'badge-info', label: 'Sent' },
    PAID: { cls: 'badge-success', label: 'Paid' },
    OVERDUE: { cls: 'badge-danger', label: 'Overdue' },
    CANCELLED: { cls: 'badge-warning', label: 'Cancelled' },
  }
  const { cls, label } = map[status] || map.DRAFT
  return <span className={`badge ${cls}`}>{label}</span>
}

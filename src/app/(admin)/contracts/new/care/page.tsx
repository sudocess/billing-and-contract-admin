import CarePlanWizard from '@/components/CarePlanWizard'

export const dynamic = 'force-dynamic'

export default function NewCarePlanPage() {
  return (
    <>
      <div className="bg-white px-4 sm:px-8 py-4 flex items-center justify-between border-b border-brown-dark/10 sticky top-0 z-50">
        <h1 className="font-heading text-lg font-extrabold text-brown-dark">New care plan</h1>
      </div>
      <div className="p-4 sm:p-7 flex-1">
        <CarePlanWizard />
      </div>
    </>
  )
}

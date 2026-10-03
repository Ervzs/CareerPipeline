import type { Company } from '../../lib/types'
import { Dialog } from '../Dialog'
import { CompanyForm } from './CompanyForm'

export function CompanyEditDialog({ company, onClose }: { company: Company; onClose: () => void }) {
  return (
    <Dialog title={`Edit ${company.name}`} onClose={onClose}>
      <CompanyForm company={company} onDone={onClose} />
    </Dialog>
  )
}

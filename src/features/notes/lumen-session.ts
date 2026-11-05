import type { AtlasRepository } from '../../data/repositories/atlas-repository'
import type { Note } from '../../data/models'
import type {
  LumenAtlasRepository,
  LumenHistory,
  LumenRestorePlan,
} from '../../data/repositories/lumen-atlas-repository'
import type { LumenImportPlan } from '../../lib/lumen-atlas/plan'
import {
  maxPackageBytes,
  recordHash,
  sha256,
} from '../../lib/lumen-atlas/hashes'
import { fail, LumenTransferError } from '../../lib/lumen-atlas/errors'

export interface PackageFile {
  readonly name: string
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}
export interface TransferState {
  readonly phase:
    | 'choose'
    | 'preview'
    | 'confirm'
    | 'result'
    | 'history'
    | 'restore-preview'
    | 'restore-confirm'
  readonly busy: boolean
  readonly writing: boolean
  readonly message: string
  readonly error: string | null
  readonly file: PackageFile | null
  readonly plan: LumenImportPlan | null
  readonly current: Note | null
  readonly history: LumenHistory['operations']
  readonly restore: LumenRestorePlan | null
}
const initial = (): TransferState => ({
  phase: 'choose',
  busy: false,
  writing: false,
  message: '',
  error: null,
  file: null,
  plan: null,
  current: null,
  history: [],
  restore: null,
})
export class LumenTransferSession {
  private state = initial()
  private epoch = 0
  private listeners = new Set<() => void>()
  private readonly transfer: Pick<
    LumenAtlasRepository,
    'plan' | 'execute' | 'operations' | 'planRestore' | 'restore'
  >
  private readonly notes: Pick<AtlasRepository, 'snapshot'>
  constructor(
    transfer: LumenTransferSession['transfer'],
    notes: LumenTransferSession['notes'],
  ) {
    this.transfer = transfer
    this.notes = notes
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(patch: Partial<TransferState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  cancel = () => {
    if (this.state.writing) return false
    this.epoch++
    this.set({
      ...initial(),
      phase: 'result',
      message: 'Operação cancelada. Nenhuma alteração foi executada.',
    })
    return true
  }
  invalidate = () => {
    if (
      this.state.writing ||
      (!this.state.plan && !this.state.restore && !this.state.busy)
    )
      return
    this.epoch++
    this.set({
      plan: null,
      restore: null,
      current: null,
      phase: this.state.phase.startsWith('restore') ? 'history' : 'choose',
      busy: false,
      error: 'plan_stale',
      message: 'O estado mudou. Valide e revise novamente.',
    })
  }
  private code(error: unknown) {
    return error instanceof LumenTransferError ? error.code : 'transfer_failed'
  }
  private async bytes(file: PackageFile) {
    if (file.size > maxPackageBytes) fail('package_size')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > maxPackageBytes) fail('package_size')
    return bytes
  }
  select = async (file: PackageFile | null) => {
    if (this.state.writing) return
    if (!file) {
      this.cancel()
      return
    }
    const epoch = ++this.epoch
    this.set({
      ...initial(),
      file,
      busy: true,
      message: 'Validando pacote e preparando plano…',
    })
    try {
      const plan = await this.transfer.plan(await this.bytes(file))
      const data = await this.notes.snapshot()
      const current =
        data.notes.find((n) => n.id === plan.integrationId) ?? null
      if ((await recordHash(current)) !== plan.expectedRecordHash)
        fail('plan_stale')
      if (epoch === this.epoch)
        this.set({ plan, current, phase: 'preview', busy: false, message: '' })
    } catch (error) {
      if (epoch === this.epoch)
        this.set({
          busy: false,
          error: this.code(error),
          message: 'Pacote não preparado para importação.',
        })
    }
  }
  review = () => {
    if (
      !this.state.busy &&
      this.state.plan &&
      this.state.plan.operation !== 'conflict'
    )
      this.set({ phase: 'confirm', message: '' })
  }
  back = () => {
    if (!this.state.busy)
      this.set({ phase: this.state.restore ? 'restore-preview' : 'preview' })
  }
  confirm = async () => {
    const { plan, file, phase, busy } = this.state
    if (
      busy ||
      phase !== 'confirm' ||
      !plan ||
      !file ||
      plan.operation === 'conflict'
    )
      return
    const epoch = this.epoch
    this.set({
      busy: true,
      message: 'Conferindo a versão selecionada…',
      error: null,
    })
    try {
      if (
        (await sha256(await this.bytes(file))) !== plan.proposed.package_sha256
      )
        fail('package_changed')
      if (epoch !== this.epoch) return
      this.set({ writing: true, message: 'Executando a operação confirmada…' })
      const result = await this.transfer.execute(plan, { confirmed: true })
      const message =
        result.outcome === 'identical'
          ? 'Reimportação idêntica. Nenhum campo ou timestamp foi alterado.'
          : result.outcome === 'created'
            ? 'Nota criada. Histórico local registrado.'
            : 'Nota atualizada. Versão anterior registrada no histórico local.'
      this.set({
        phase: 'result',
        busy: false,
        writing: false,
        plan: null,
        message,
      })
    } catch (error) {
      if (epoch === this.epoch)
        this.set({
          phase: 'result',
          busy: false,
          writing: false,
          plan: null,
          error: this.code(error),
          message:
            'Importação não concluída. Confira o diagnóstico antes de repetir.',
        })
    }
  }
  loadHistory = async () => {
    if (this.state.writing) return
    const epoch = ++this.epoch
    this.set({
      ...initial(),
      phase: 'history',
      busy: true,
      message: 'Conferindo histórico local…',
    })
    try {
      const history = await this.transfer.operations()
      if (epoch === this.epoch)
        this.set({
          history,
          busy: false,
          message: history.length
            ? ''
            : 'Nenhuma operação Lumen registrada neste navegador.',
        })
    } catch (error) {
      if (epoch === this.epoch)
        this.set({
          busy: false,
          error: this.code(error),
          message:
            'Histórico indisponível. Não tente reconstruir evidência por aproximação.',
        })
    }
  }
  selectRestore = async (operationId: string) => {
    if (this.state.busy) return
    const epoch = ++this.epoch
    this.set({
      restore: null,
      current: null,
      busy: true,
      error: null,
      message: 'Conferindo a versão recuperável…',
    })
    try {
      const restore = await this.transfer.planRestore(operationId)
      const current =
        (await this.notes.snapshot()).notes.find(
          (n) => n.id === restore.integrationId,
        ) ?? null
      if ((await recordHash(current)) !== restore.expectedRecordHash)
        fail('recovery_conflict')
      if (epoch === this.epoch)
        this.set({
          restore,
          current,
          phase: 'restore-preview',
          busy: false,
          message: '',
        })
    } catch (error) {
      if (epoch === this.epoch)
        this.set({
          busy: false,
          error: this.code(error),
          message: 'Restauração bloqueada. Nenhuma nota foi alterada.',
        })
    }
  }
  reviewRestore = () => {
    if (!this.state.busy && this.state.restore)
      this.set({ phase: 'restore-confirm' })
  }
  confirmRestore = async () => {
    const { restore, phase, busy } = this.state
    if (busy || !restore || phase !== 'restore-confirm') return
    this.set({
      busy: true,
      writing: true,
      error: null,
      message: 'Restaurando somente a nota confirmada…',
    })
    try {
      await this.transfer.restore(restore, { confirmed: true })
      this.set({
        phase: 'result',
        restore: null,
        busy: false,
        writing: false,
        message:
          'Versão anterior restaurada. Outras notas e rascunhos foram preservados.',
      })
    } catch (error) {
      this.set({
        phase: 'result',
        restore: null,
        busy: false,
        writing: false,
        error: this.code(error),
        message:
          'Restauração não concluída. Confira o diagnóstico antes de repetir.',
      })
    }
  }
}

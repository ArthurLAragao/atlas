/** Fixed copy only: arbitrary parser/exception excerpts never reach the UI. */
const messages: Record<string, string> = {
  draft_exists:
    'Há edição pendente nesta nota. Resolva o rascunho no editor antes de atualizar.',
  draft_state_unknown:
    'Não foi possível verificar os rascunhos. A operação está bloqueada por segurança.',
  draft_state_changed:
    'O estado dos rascunhos mudou ou ficou indisponível. Revise novamente.',
  draft_state_unknown_or_exists:
    'Há rascunho pendente ou a verificação está indisponível. Restauração bloqueada.',
  identity_uncertain:
    'Evidência de identidade insuficiente. O histórico local não comprova esta nota.',
  candidate_under_other_id:
    'Existe candidata com outro ID. Nenhuma adoção automática é permitida.',
  update_target_missing:
    'Destino da atualização ausente. A nota não será recriada silenciosamente.',
  title_changed:
    'Mudança de título bloqueada pelo contrato. Nenhuma substituição será executada.',
  baseline_required: 'Atualização exige referência anterior explícita.',
  baseline_mismatch:
    'Conflito com a versão local. O Atlas tem alterações que não podem ser sobrescritas.',
  recovery_capacity:
    'Limite de recuperação atingido (100 operações / 20 MiB). Escrita bloqueada; não há limpeza automática.',
  recovery_unavailable:
    'Histórico de recuperação inválido ou indisponível. Escrita bloqueada.',
  recovery_not_available:
    'Esta operação não possui versão anterior recuperável ou já foi restaurada. Não há exclusão automática.',
  recovery_conflict:
    'A nota mudou desde esta operação. Restauração bloqueada para preservar a versão atual.',
  identity_in_other_collection:
    'A identidade já pertence a outra entidade. Operação bloqueada.',
  note_limit: 'O limite de notas do Atlas foi atingido.',
  plan_stale: 'A confirmação ficou obsoleta. Valide e revise novamente.',
  package_changed:
    'O arquivo mudou após a prévia. Selecione e valide a nova versão.',
  package_size: 'O pacote excede o limite do contrato (2 MiB).',
  repository_write_failed:
    'Falha na operação transacional. Confira o estado antes de repetir; não use substituição forçada.',
  recovery_write_failed:
    'Falha na restauração transacional. Confira o estado antes de repetir.',
  wikilinks_preserved_without_resolution:
    'Wikilinks e embeds do Obsidian são preservados como texto; sua navegação não é garantida no Atlas.',
  local_recovery_not_in_backups:
    'Histórico local Lumen não incluído nos backups atuais.',
  unknown_yaml_properties:
    'O YAML contém propriedades adicionais preservadas como texto.',
  title_heading: 'O título principal do Markdown difere do título declarado.',
  missing_section_0: 'Seção recomendada ausente: Resumo.',
  missing_section_1: 'Seção recomendada ausente: Explicação.',
  missing_section_2: 'Seção recomendada ausente: Exemplos e aplicação.',
  missing_section_3: 'Seção recomendada ausente: Revisão.',
  missing_section_4: 'Seção recomendada ausente: Fontes.',
  missing_section_5: 'Seção recomendada ausente: Registro pessoal.',
  transfer_failed:
    'Não foi possível acessar ou conferir esta operação. Nenhuma tentativa automática será feita.',
}
export function lumenMessage(code: string) {
  return (
    messages[code] ??
    'Pacote inválido ou operação bloqueada. Diagnóstico: ' + code
  )
}
export const operationLabel = {
  create: 'Criar nota',
  identical: 'Reimportação idêntica, sem alterações',
  update: 'Atualização elegível',
  conflict: 'Conflito bloqueado',
} as const
export const historyNotice =
  'Histórico local deste navegador, não incluído nos backups atuais. Limite de 100 operações / 20 MiB, sem limpeza automática. Ao atingir o limite, atualizações são bloqueadas. Restaurar um backup pode perder a evidência e bloquear futuras atualizações.'

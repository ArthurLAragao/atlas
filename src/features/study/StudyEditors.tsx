import type { Subject, StudyPath } from '../../data/models'
import { subjectSchema, studyPathSchema } from '../../data/models'
import { repository } from '../../data/service'
import { studyChange } from './study-store'
import { useActiveForm } from '../goals/use-active-form'
import {
  base,
  Field,
  number,
  optional,
  StudyForm,
  tags,
  text,
} from './StudyForm'

export type StudyKind = 'subjects' | 'studyPaths'
export function StudyEditor({
  subject,
  path,
  kind,
  onClose,
  onSaved,
}: {
  subject?: Subject
  path?: StudyPath
  kind: StudyKind
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const item = subject ?? path
  const active = useActiveForm()
  return (
    <StudyForm
      title={
        item
          ? `Editar ${subject ? 'disciplina' : 'trilha'}`
          : kind === 'subjects'
            ? 'Nova disciplina'
            : 'Nova trilha'
      }
      onClose={onClose}
      submit={kind === 'subjects' ? 'Salvar disciplina' : 'Salvar trilha'}
      onSubmit={async (values) => {
        const common = {
          ...(item ?? base()),
          title: text(values, 'title'),
          tags: tags(values),
          status: text(values, 'status'),
        }
        const result =
          kind === 'subjects'
            ? subjectSchema.safeParse({
                ...common,
                code: optional(values, 'code'),
                semester: optional(values, 'semester'),
                professor: optional(values, 'professor'),
                color: text(values, 'color'),
                hours: number(values, 'hours'),
                notes: text(values, 'notes'),
                absences: subject?.absences ?? 0,
                absenceLimit: number(values, 'absenceLimit'),
                classesHeld: number(values, 'classesHeld'),
                assessments: subject?.assessments ?? [],
                events: subject?.events ?? [],
              })
            : studyPathSchema.safeParse({
                ...common,
                description: text(values, 'description'),
                steps: path?.steps ?? [],
              })
        if (!result.success)
          throw new Error(
            'Revise o nome e os detalhes: use números positivos para a carga horária e inteiros não negativos para faltas e aulas. Textos de detalhes aceitam até 50.000 caracteres.',
          )
        const ok = await studyChange(
          async () =>
            (kind === 'subjects'
              ? await repository.saveStudy(
                  'subjects',
                  result.data as Subject,
                  item?.updatedAt ?? null,
                )
              : await repository.saveStudy(
                  'studyPaths',
                  result.data as StudyPath,
                  item?.updatedAt ?? null,
                )
            ).data,
          'Registro salvo.',
        )
        if (ok && active.current) onSaved(result.data.id)
        return ok
      }}
    >
      <Field
        label={kind === 'subjects' ? 'Nome da disciplina' : 'Título da trilha'}
        name="title"
        value={item?.title}
        required
      />
      <label>
        Estado
        <select
          name="status"
          defaultValue={item?.status === 'completed' ? 'completed' : 'active'}
        >
          <option value="active">Ativa</option>
          <option value="completed">Concluída</option>
        </select>
      </label>
      {kind === 'subjects' ? (
        <>
          <details>
            <summary>Detalhes da disciplina</summary>
            <div className="direction-form">
              <Field label="Código" name="code" value={subject?.code} />
              <Field
                label="Semestre"
                name="semester"
                value={subject?.semester}
              />
              <Field
                label="Professor"
                name="professor"
                value={subject?.professor}
              />
              <label>
                Identificação
                <select name="color" defaultValue={subject?.color ?? 'neutral'}>
                  <option value="neutral">Neutra</option>
                  <option value="accent">Destaque</option>
                  <option value="success">Verde</option>
                </select>
              </label>
              <Field
                label="Carga horária"
                name="hours"
                type="number"
                value={subject?.hours}
                min={1}
                max={10000}
              />
              <label>
                Anotações
                <textarea
                  name="notes"
                  defaultValue={subject?.notes}
                  maxLength={50000}
                />
              </label>
            </div>
          </details>
          <details>
            <summary>Presença</summary>
            <div className="direction-form">
              <p className="direction-help">
                Conte faltas e aulas na mesma unidade (aulas ou horas). A
                estimativa usa somente as aulas já realizadas.
              </p>
              <Field
                label="Limite de faltas"
                name="absenceLimit"
                type="number"
                value={subject?.absenceLimit}
                min={0}
                max={10000}
              />
              <Field
                label="Aulas realizadas"
                name="classesHeld"
                type="number"
                value={subject?.classesHeld}
                min={0}
                max={10000}
              />
            </div>
          </details>
        </>
      ) : (
        <label>
          Descrição
          <textarea
            name="description"
            defaultValue={path?.description}
            maxLength={50000}
          />
        </label>
      )}
      <Field label="Tags" name="tags" value={item?.tags.join(', ')} />
    </StudyForm>
  )
}

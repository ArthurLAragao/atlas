import type { Subject } from '../../data/models'
import { subjectSchema } from '../../data/models'
import { repository } from '../../data/service'
import { studyChange } from './study-store'
import { Field, number, optional, StudyForm, text } from './StudyForm'

export function AssessmentForm({
  subject,
  assessment,
  onClose,
}: {
  subject: Subject
  assessment?: Subject['assessments'][number]
  onClose: () => void
}) {
  return (
    <StudyForm
      title={assessment ? 'Editar avaliação' : 'Adicionar avaliação'}
      onClose={onClose}
      onSubmit={async (values) => {
        const item = {
          id: assessment?.id ?? crypto.randomUUID(),
          title: text(values, 'title'),
          weight: number(values, 'weight'),
          score: number(values, 'score'),
          maxScore: number(values, 'maxScore'),
          date: optional(values, 'date'),
          notes: text(values, 'notes'),
        }
        const result = subjectSchema.safeParse({
          ...subject,
          assessments: assessment
            ? subject.assessments.map((record) =>
                record.id === item.id ? item : record,
              )
            : [...subject.assessments, item],
        })
        if (!result.success)
          throw new Error(
            'Use uma nota entre zero e a nota máxima; a nota máxima e o peso precisam ser maiores que zero. Revise também a data e o nome da avaliação.',
          )
        return studyChange(
          async () =>
            (
              await repository.saveStudy(
                'subjects',
                result.data,
                subject.updatedAt,
              )
            ).data,
          'Avaliação salva.',
        )
      }}
    >
      <Field
        label="Nome da avaliação"
        name="title"
        value={assessment?.title}
        required
      />
      <div className="direction-fields">
        <Field
          label="Nota obtida"
          name="score"
          value={assessment?.score}
          type="number"
          min={0}
          step="any"
          required
        />
        <Field
          label="Nota máxima"
          name="maxScore"
          value={assessment?.maxScore ?? 10}
          type="number"
          min={0.01}
          step="any"
          required
        />
      </div>
      <Field
        label="Peso"
        name="weight"
        value={assessment?.weight}
        type="number"
        min={0.01}
        step="any"
      />
      <p className="direction-help">
        As notas são normalizadas para 0–10. Sem pesos: média simples. Com
        pesos: média ponderada, usando peso 1 nas avaliações sem peso.
      </p>
      <Field label="Data" name="date" value={assessment?.date} type="date" />
      <label>
        Observação
        <textarea
          name="notes"
          defaultValue={assessment?.notes}
          maxLength={10000}
        />
      </label>
    </StudyForm>
  )
}

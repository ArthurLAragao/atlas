import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from './PageHeader'
import { LocalRecords } from './LocalRecords'
import type { Collection } from '../data/models'

interface ModuleIntroProps {
  title: string
  description: string
  icon: LucideIcon
  next: string
  features: readonly string[]
  collection?: Collection
}
export function ModuleIntro({
  title,
  description,
  icon: Icon,
  next,
  features,
  collection,
}: ModuleIntroProps) {
  return (
    <>
      <PageHeader title={title} eyebrow="Seu espaço pessoal">
        {description}
      </PageHeader>
      {collection && <LocalRecords collection={collection} />}
      {collection === 'goals' && <LocalRecords collection="projects" />}
      <section className="module-intro" aria-labelledby="module-status">
        <div className="module-symbol">
          <Icon aria-hidden="true" />
        </div>
        <p className="eyebrow">Em construção</p>
        <h2 id="module-status">Um lugar para {next}.</h2>
        <p>
          Seus dados já ficam salvos neste navegador. A criação e a edição neste
          módulo chegam nas próximas etapas; por enquanto, use “Seus dados” para
          importar conteúdo.
        </p>
        <ul className="feature-list">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
        <Link className="button" to="/">
          <ArrowLeft aria-hidden="true" />
          Voltar para Hoje
        </Link>
      </section>
    </>
  )
}

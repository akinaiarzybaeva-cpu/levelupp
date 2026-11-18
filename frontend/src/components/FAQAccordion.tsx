import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function FAQAccordion({ question, answer, defaultOpen }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className={open ? 'faq-item open' : 'faq-item'}>
      <button type="button" className="faq-question" onClick={() => setOpen((value) => !value)}>
        <span>{question}</span>
        <ChevronDown size={16} />
      </button>
      {open && <div className="faq-answer"><p>{answer}</p></div>}
    </div>
  )
}

import React, { useState } from 'react'
import PropTypes from 'prop-types'

const MAX_PAGES_WITHOUT_GAP = 6

// Up to six pages show in full; beyond that the current page's run, a gap and the last page.
const visiblePages = (page, pageCount) => {
  if (pageCount <= MAX_PAGES_WITHOUT_GAP) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(page - 2, pageCount - 5))
  const run = Array.from({ length: 5 }, (_, i) => start + i)
  return run[run.length - 1] >= pageCount - 1 ? [...run, pageCount].filter((value, i, all) => all.indexOf(value) === i) : [...run, 'gap', pageCount]
}

function Pagination({ page, pageCount, onChange }) {
  const [goTo, setGoTo] = useState('')
  if (pageCount <= 1) return null

  const go = (next) => {
    const target = Math.min(pageCount, Math.max(1, next))
    if (target !== page) onChange(target)
  }
  const submitGoTo = (event) => {
    event.preventDefault()
    const target = parseInt(goTo, 10)
    if (!Number.isNaN(target)) go(target)
    setGoTo('')
  }

  return (
    <nav className='pagination' aria-label='分頁'>
      <button type='button' className='pagination-arrow' aria-label='上一頁' disabled={page <= 1} onClick={() => go(page - 1)}>
        <img src='/design/ui/chevron-left.svg' alt='' width={16} height={16} />
      </button>
      {visiblePages(page, pageCount).map((value) => value === 'gap'
        ? <span key='gap' className='pagination-gap' aria-hidden='true'>...</span>
        : <button key={value} type='button' className={`pagination-page ${value === page ? 'pagination-page-current' : ''}`} aria-current={value === page ? 'page' : undefined} onClick={() => go(value)}>{value}</button>)}
      <button type='button' className='pagination-arrow' aria-label='下一頁' disabled={page >= pageCount} onClick={() => go(page + 1)}>
        <img src='/design/ui/chevron-right.svg' alt='' width={16} height={16} />
      </button>
      {pageCount > MAX_PAGES_WITHOUT_GAP && (
        <form className='pagination-goto' onSubmit={submitGoTo}>
          <label htmlFor='pagination-goto-input'>GO to page</label>
          <span className='pagination-goto-field'>
            <input id='pagination-goto-input' inputMode='numeric' value={goTo} onChange={(event) => setGoTo(event.target.value.replace(/\D/g, ''))} />
            <button type='submit' aria-label='前往此頁'><img src='/design/ui/chevron-right.svg' alt='' width={16} height={16} /></button>
          </span>
        </form>
      )}
    </nav>
  )
}

Pagination.propTypes = {
  page: PropTypes.number.isRequired,
  pageCount: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default Pagination

import { useEffect, useMemo, useState } from 'react'

// Pages a list that is already in memory. The page moves back if the list shrinks past it.
export default function usePagination(items, pageSize = 10) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize])

  return { page, pageCount, pageItems, setPage }
}

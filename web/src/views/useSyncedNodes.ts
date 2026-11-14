import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react'
import { useEffect, useState } from 'react'

/** Nodes derived from the model each render, keeping the sizes React Flow measured (as Lagrange's LiveGraph does).
 *  Without this, controlled nodes are never measured and stay hidden. */
export function useSyncedNodes<N extends Node>(derived: N[]) {
  const [nodes, setNodes] = useState<N[]>(derived)
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]))
      return derived.map((d) => {
        const p = old.get(d.id)
        return p?.measured ? { ...d, measured: p.measured } : d
      })
    })
  }, [derived])
  const onNodesChange = (changes: NodeChange<N>[]) => setNodes((ns) => applyNodeChanges(changes, ns))
  return [nodes, onNodesChange] as const
}

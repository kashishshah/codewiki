import { useState, useEffect } from "react";
import { fetchGraph, fetchNode } from "../api";
import type { GraphData, NodeDetail } from "../types";

export function useGraph() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGraph()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

export function useNodeDetail(nodeId: string | null) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);

  useEffect(() => {
    if (!nodeId) {
      setDetail(null);
      return;
    }
    fetchNode(nodeId)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [nodeId]);

  return { detail };
}

"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { EvolutionSnapshot } from "@/lib/types";

type Props = {
  data: EvolutionSnapshot[];
};

export function ScoreChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="empty-panel">暂无演进数据。完成两轮以上分析和面试后，这里会出现能力曲线。</div>;
  }

  const chartData = data.map((item, index) => ({
    name: `V${index + 1}`,
    总分: item.totalScore,
    简历基线: item.baselineScore,
    技能覆盖: item.skillCoverage,
    项目支撑: item.projectAlignment,
    沟通得分: item.communicationScore,
  }));

  return (
    <div className="chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ left: -18, right: 12, top: 6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120, 138, 159, 0.2)" />
          <XAxis dataKey="name" stroke="#6a7280" tickLine={false} axisLine={false} />
          <YAxis stroke="#6a7280" tickLine={false} axisLine={false} domain={[0, 100]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="总分" stroke="#ff6b35" strokeWidth={3} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="简历基线" stroke="#1f7a8c" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="项目支撑" stroke="#2d936c" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="沟通得分" stroke="#5f0f40" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

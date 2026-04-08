"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { AlertCircle, BarChart3, BrainCircuit, FileUp, MessageSquare, RefreshCcw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { ScoreChart } from "@/components/score-chart";
import type { DashboardState } from "@/lib/types";

type Props = {
  initialState: DashboardState;
};

async function jsonFetch<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

export function Dashboard({ initialState }: Props) {
  const [state, setState] = useState(initialState);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [editorText, setEditorText] = useState(initialState.latestVersion?.rawText || "");
  const [statusText, setStatusText] = useState("等待上传简历。");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeQuestion = useMemo(() => {
    if (!state.latestSession || state.latestSession.status !== "active") {
      return null;
    }

    return state.latestSession.coverage.questions[state.latestSession.currentQuestionIndex] ?? null;
  }, [state.latestSession]);

  const refreshState = async () => {
    const data = await jsonFetch<DashboardState>("/api/state");
    setState(data);
    setEditorText(data.latestImprovement?.rewrittenResume || data.latestVersion?.rawText || "");
  };

  const runAction = (label: string, action: () => Promise<void>) => {
    setErrorText(null);
    setStatusText(label);
    setPendingAction(label);

    startTransition(async () => {
      try {
        await action();
        await refreshState();
        setStatusText(`${label} 完成。`);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : "发生未知错误");
        setStatusText(`${label} 失败。`);
      } finally {
        setPendingAction(null);
      }
    });
  };

  const isUploading = pendingAction === "上传并解析简历";
  const isAnalyzing = pendingAction === "运行简历分析";
  const isInterviewStarting = pendingAction === "生成模拟面试";
  const isResponding = pendingAction === "提交回答";
  const isGeneratingSuggestions = pendingAction === "生成优化建议";
  const isSavingVersion = pendingAction === "保存新的简历版本";
  const isRefreshing = isPending && pendingAction === null;

  const handleUpload = () => {
    if (!uploadFile) {
      setErrorText("请先选择 PDF 简历。");
      return;
    }

    runAction("上传并解析简历", async () => {
      const formData = new FormData();
      formData.append("file", uploadFile);

      await jsonFetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      setUploadFile(null);
    });
  };

  const handleRunAnalysis = () => {
    runAction("运行简历分析", async () => {
      await jsonFetch("/api/analysis/run", {
        method: "POST",
      });
    });
  };

  const handleStartInterview = () => {
    runAction("生成模拟面试", async () => {
      await jsonFetch("/api/interview/start", {
        method: "POST",
      });
      setInterviewAnswer("");
    });
  };

  const handleRespond = () => {
    if (!interviewAnswer.trim()) {
      setErrorText("请先输入你的回答。");
      return;
    }

    runAction("提交回答", async () => {
      await jsonFetch("/api/interview/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: interviewAnswer,
        }),
      });
      setInterviewAnswer("");
    });
  };

  const handleGenerateSuggestions = () => {
    runAction("生成优化建议", async () => {
      await jsonFetch("/api/improvement/generate", {
        method: "POST",
      });
    });
  };

  const handleSaveVersion = () => {
    if (!editorText.trim()) {
      setErrorText("简历内容不能为空。");
      return;
    }

    runAction("保存新的简历版本", async () => {
      await jsonFetch("/api/resume/version", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText: editorText,
        }),
      });
    });
  };

  return (
    <main className="shell">
      {isPending ? (
        <div className="loading-overlay" aria-live="polite" aria-busy="true">
          <div className="loading-overlay-card">
            <span className="spinner" />
            <strong>{pendingAction || "同步最新状态"}</strong>
            <p>请求进行中，请稍候。</p>
          </div>
        </div>
      ) : null}

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Resume Lab / Next.js + LangGraph.js</span>
          <h1>上传简历，拆解技能证据，跑一轮面试，再把分数拉上去。</h1>
          <p>
            这个工作台围绕单用户本地开发设计。你可以上传 PDF、运行简历分析、进入多轮模拟面试、保存修改版简历，并查看分数和能力画像的演进轨迹。
          </p>
        </div>
        <div className="hero-metrics">
          <div className="metric-card">
            <span>模型状态</span>
            <strong>{state.hasApiKey ? "OpenAI 已连接" : "Mock 模式"}</strong>
            <small>{state.hasApiKey ? "将调用真实 LLM" : "未检测到 OPENAI_API_KEY，当前使用本地回退逻辑"}</small>
          </div>
          <div className="metric-card">
            <span>当前总分</span>
            <strong>{state.latestScorecard?.totalScore ?? state.latestAnalysis?.baselineScore ?? "--"}</strong>
            <small>优先显示面试评分，没有则显示简历基线分</small>
          </div>
        </div>
      </section>

      <section className="status-strip">
        <div>
          <span className="status-label">执行状态</span>
          <strong>{isPending ? `${pendingAction || "处理中"}...` : statusText}</strong>
        </div>
        {isPending ? (
          <div className="pending-chip">
            <span className="spinner spinner-inline" />
            <span>{pendingAction || "处理中"}</span>
          </div>
        ) : null}
        {errorText ? (
          <div className="error-banner">
            <AlertCircle size={16} />
            <span>{errorText}</span>
          </div>
        ) : null}
      </section>

      <section className="grid two-up">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><FileUp size={18} /></span>
              <h2>1. 上传简历</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => void refreshState()} disabled={isPending}>
              <RefreshCcw size={16} />
              {isRefreshing ? "刷新中..." : "刷新"}
            </button>
          </div>
          <p className="panel-copy">上传可复制文本的 PDF。系统会提取文本并创建一个新的简历版本。</p>
          <div className="upload-box">
            <input
              type="file"
              accept="application/pdf"
              disabled={isPending}
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
            <button className="primary-button" type="button" onClick={handleUpload} disabled={isPending}>
              {isUploading ? "上传中..." : "上传并解析"}
            </button>
          </div>
          {isUploading ? <div className="inline-loading">正在提取 PDF 文本并写入本地版本库...</div> : null}
          {state.latestVersion ? (
            <div className="meta-list">
              <div><span>当前版本</span><strong>{state.latestVersion.id.slice(0, 8)}</strong></div>
              <div><span>来源</span><strong>{state.latestVersion.sourceKind === "pdf" ? state.latestVersion.fileName || "PDF" : "站内编辑"}</strong></div>
              <div><span>创建时间</span><strong>{new Date(state.latestVersion.createdAt).toLocaleString()}</strong></div>
            </div>
          ) : (
            <div className="empty-panel">还没有简历版本。先上传一份 PDF。</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><BrainCircuit size={18} /></span>
              <h2>2. 运行分析</h2>
            </div>
            <button className="primary-button" type="button" onClick={handleRunAnalysis} disabled={isPending || !state.latestVersion}>
              {isAnalyzing ? "分析中..." : "运行简历分析"}
            </button>
          </div>
          {isAnalyzing ? <div className="inline-loading">正在提炼技能、映射项目证据并生成简历基线分...</div> : null}
          {state.latestAnalysis ? (
            <div className="analysis-summary">
              <div className="score-badge">
                <span>简历基线分</span>
                <strong>{state.latestAnalysis.baselineScore}</strong>
              </div>
              <p>{state.latestAnalysis.summary.headline}</p>
              <div className="chip-row">
                <span className="chip">技能覆盖 {state.latestAnalysis.summary.skillCoverage}</span>
                <span className="chip">项目支撑 {state.latestAnalysis.summary.projectAlignment}</span>
                <span className="chip">技能数 {state.latestSkills.length}</span>
              </div>
            </div>
          ) : (
            <div className="empty-panel">上传完成后运行一次分析，这里会展示技能图谱和基线评估。</div>
          )}
        </article>
      </section>

      <section className="grid two-up">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><BarChart3 size={18} /></span>
              <h2>技能与项目映射</h2>
            </div>
          </div>
          {isAnalyzing ? (
            <div className="loading-block">
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-grid">
                <div className="skeleton-card" />
                <div className="skeleton-card" />
              </div>
            </div>
          ) : null}
          {!isAnalyzing && state.latestSkills.length > 0 ? (
            <div className="skill-grid">
              {state.latestSkills.map((skill) => (
                <div className="skill-card" key={skill.id ?? skill.name}>
                  <div className="skill-card-top">
                    <strong>{skill.name}</strong>
                    <span className={clsx("level-pill", skill.level)}>{skill.level}</span>
                  </div>
                  <span className="muted">{skill.category}</span>
                  <p>{skill.evidence}</p>
                  <div className="chip-row">
                    {skill.projectNames.map((project) => (
                      <span className="chip" key={`${skill.name}-${project}`}>{project}</span>
                    ))}
                  </div>
                  <small>面试重点：{skill.interviewFocus}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">暂无技能映射结果。</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><Sparkles size={18} /></span>
              <h2>优势与薄弱处</h2>
            </div>
          </div>
          {isAnalyzing ? (
            <div className="loading-block">
              <div className="skeleton-line short" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
            </div>
          ) : null}
          {!isAnalyzing && state.latestAnalysis ? (
            <div className="markdown-grid">
              <div className="markdown-card">
                <ReactMarkdown>{state.latestAnalysis.strengthsMarkdown}</ReactMarkdown>
              </div>
              <div className="markdown-card">
                <ReactMarkdown>{state.latestAnalysis.weaknessesMarkdown}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="empty-panel">分析完成后这里会回指出优势、短板和面试关注点。</div>
          )}
        </article>
      </section>

      <section className="grid two-up interview-layout">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><MessageSquare size={18} /></span>
              <h2>3. 模拟面试</h2>
            </div>
            <button className="primary-button" type="button" onClick={handleStartInterview} disabled={isPending || !state.latestAnalysis}>
              {isInterviewStarting ? "生成问题中..." : "开始一轮面试"}
            </button>
          </div>
          <div className="chat-log">
            {isInterviewStarting ? (
              <div className="loading-block">
                <div className="message-bubble assistant loading-bubble">
                  <span>面试官</span>
                  <p>正在生成第一轮面试问题...</p>
                </div>
              </div>
            ) : state.latestMessages.length > 0 ? (
              state.latestMessages.map((message) => (
                <div className={clsx("message-bubble", message.role)} key={message.id}>
                  <span>{message.role === "assistant" ? "面试官" : "你"}</span>
                  <p>{message.content}</p>
                </div>
              ))
            ) : (
              <div className="empty-panel">启动面试后，问题和回答会记录在这里。</div>
            )}
          </div>
          {activeQuestion ? (
            <div className="composer">
              <textarea
                value={interviewAnswer}
                disabled={isPending}
                onChange={(event) => setInterviewAnswer(event.target.value)}
                placeholder="用 STAR 或 场景-动作-结果 结构回答，尽量讲清楚你的个人贡献、权衡和指标结果。"
              />
              <button className="primary-button" type="button" onClick={handleRespond} disabled={isPending}>
                {isResponding ? "评估中..." : "提交回答"}
              </button>
            </div>
          ) : null}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><BarChart3 size={18} /></span>
              <h2>面试评分</h2>
            </div>
          </div>
          {isResponding ? (
            <div className="loading-block">
              <div className="inline-loading">正在评估回答质量并决定下一轮追问...</div>
            </div>
          ) : null}
          {!isResponding && state.latestScorecard ? (
            <div className="scorecard">
              <div className="score-grid">
                <div><span>总分</span><strong>{state.latestScorecard.totalScore}</strong></div>
                <div><span>技术深度</span><strong>{state.latestScorecard.technicalScore}</strong></div>
                <div><span>项目支撑</span><strong>{state.latestScorecard.projectScore}</strong></div>
                <div><span>沟通表达</span><strong>{state.latestScorecard.communicationScore}</strong></div>
                <div><span>软素质</span><strong>{state.latestScorecard.behavioralScore}</strong></div>
              </div>
              <div className="markdown-card">
                <ReactMarkdown>{state.latestScorecard.rationale}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="empty-panel">完成一轮面试后，这里会显示总分和分维度评分。</div>
          )}
        </article>
      </section>

      <section className="grid two-up">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><Sparkles size={18} /></span>
              <h2>4. 优化建议</h2>
            </div>
            <button className="primary-button" type="button" onClick={handleGenerateSuggestions} disabled={isPending || !state.latestAnalysis}>
              {isGeneratingSuggestions ? "生成中..." : "生成建议"}
            </button>
          </div>
          {isGeneratingSuggestions ? (
            <div className="loading-block">
              <div className="inline-loading">正在整合简历分析与面试表现，生成建议和改写草稿...</div>
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          ) : null}
          {!isGeneratingSuggestions && state.latestImprovement ? (
            <div className="suggestion-list">
              <p>{state.latestImprovement.overview}</p>
              {state.latestImprovement.suggestions.map((item) => (
                <div className="suggestion-card" key={item.title}>
                  <strong>{item.title}</strong>
                  <p><span>问题：</span>{item.problem}</p>
                  <p><span>建议：</span>{item.recommendation}</p>
                  <p><span>证据：</span>{item.resumeEvidence}</p>
                  <p><span>引导面试官：</span>{item.interviewerAngle}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-panel">这里会结合简历分析和面试结果生成可操作的改写建议。</div>
          )}
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="panel-icon"><FileUp size={18} /></span>
              <h2>5. 站内改写与版本化</h2>
            </div>
            <button className="primary-button" type="button" onClick={handleSaveVersion} disabled={isPending || !state.latestVersion}>
              {isSavingVersion ? "保存中..." : "保存为新版本"}
            </button>
          </div>
          <textarea
            className="editor"
            value={editorText}
            disabled={isPending}
            onChange={(event) => setEditorText(event.target.value)}
            placeholder="生成建议后，这里会自动填入一版改写草稿；你也可以继续手动修改。"
          />
          {state.latestImprovement?.rewrittenResume ? (
            <div className="inline-loading">系统已生成可编辑草稿，确认后可直接保存为新版本。</div>
          ) : null}
          {isSavingVersion ? <div className="inline-loading">正在创建新的简历版本并写入历史轨迹...</div> : null}
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="panel-icon"><BarChart3 size={18} /></span>
            <h2>6. 分数与能力演进</h2>
          </div>
        </div>
        <ScoreChart data={state.evolution} />
      </section>
    </main>
  );
}

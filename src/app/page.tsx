import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            多智能体可视化小说模拟系统
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Multi-Agent Visual Novel Simulation · MVP Phase 1
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NavCard
            href="/worlds"
            title="世界管理"
            desc="创建和管理你的虚构世界"
          />
          <NavCard
            href="/providers"
            title="API Provider"
            desc="配置 LLM 服务商和模型"
          />
          <NavCard
            href="/profiles"
            title="API Profile"
            desc="模型参数预设"
          />
          <NavCard
            href="/simulation"
            title="模拟控制台"
            desc="运行场景，观察角色行为"
          />
          <NavCard
            href="/traces"
            title="Trace 调试"
            desc="查看每次模型调用的详情"
          />
          <NavCard
            href="/memories"
            title="记忆管理"
            desc="查看和审批记忆写入请求"
          />
        </section>

        <footer className="mt-16 text-sm text-zinc-500">
          <p>Spec v2.0 · MVP 单用户模式 · 不写入 C 盘</p>
        </footer>
      </div>
    </main>
  );
}

function NavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:shadow-md transition"
    >
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
    </Link>
  );
}

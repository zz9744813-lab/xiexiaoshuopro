import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">写小说 Pro</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/projects" className="hover:text-blue-600 transition-colors">
              项目列表
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <h2 className="text-4xl font-bold mb-4">AI 协同长篇小说创作</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            以故事 Bible + 多 Agent 协作为核心，AI 主导生成、人类主导决策
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/projects/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              创建新项目
            </Link>
            <Link
              href="/projects"
              className="px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              查看项目
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

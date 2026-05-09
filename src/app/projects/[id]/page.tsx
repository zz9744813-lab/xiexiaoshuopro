import Link from "next/link";

// MVP: 项目主面板
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="text-gray-500 hover:text-gray-700">
              ← 项目列表
            </Link>
            <h1 className="text-xl font-bold">项目详情</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {/* 项目导航 */}
        <nav className="flex gap-1 mb-8 border-b border-gray-200 dark:border-gray-800">
          {[
            { href: `/projects/${id}`, label: "总览" },
            { href: `/projects/${id}/volumes`, label: "卷管理" },
            { href: `/projects/${id}/characters`, label: "角色" },
            { href: `/projects/${id}/bible`, label: "世界观" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-blue-500 hover:text-blue-600 transition-colors -mb-px"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 项目总览 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-1">章节数</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-1">总字数</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <h3 className="text-sm font-medium text-gray-500 mb-1">待处理 Issue</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">快速操作</h2>
          <div className="flex gap-4 flex-wrap">
            <Link
              href={`/projects/${id}/volumes`}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              管理卷章
            </Link>
            <Link
              href={`/projects/${id}/characters`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              管理角色
            </Link>
            <Link
              href={`/projects/${id}/bible`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              世界观设定
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

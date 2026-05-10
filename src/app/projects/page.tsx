import Link from "next/link";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let allProjects: Array<{
    id: string;
    title: string;
    genre: string;
    createdAt: Date;
    safetyLevel: string | null;
  }> = [];

  try {
    allProjects = await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));
  } catch {
    // 数据库未连接时使用空列表
  }

  const genreLabels: Record<string, string> = {
    xianxia: "仙侠", romance: "言情", scifi: "科幻",
    mystery: "悬疑", literary: "文学", horror: "恐怖", fantasy: "奇幻",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold hover:text-blue-600 transition-colors">
            写小说 Pro
          </Link>
          <Link
            href="/projects/new"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            新建项目
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">我的项目</h2>

        {allProjects.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="mb-4">还没有项目</p>
            <Link
              href="/projects/new"
              className="text-blue-600 hover:underline"
            >
              创建第一个项目
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                    {genreLabels[project.genre] || project.genre}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                <div className="text-sm text-gray-500">
                  <span>{new Date(project.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

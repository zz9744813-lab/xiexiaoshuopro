"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import TiptapEditor from "@/components/editor/TiptapEditor"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function ChapterPage() {
 const params = useParams()
 const { id, chId } = params as { id: string; chId: string }
 
 const [content, setContent] = useState("")
 const [isGenerating, setIsGenerating] = useState(false)
 const [isSaving, setIsSaving] = useState(false)
 const [saved, setSaved] = useState(false)

 const handleSave = async () => {
 if (!content) return
 setIsSaving(true)
 try {
 await fetch(`/api/chapters/${chId}/save`, {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ contentMd: content }),
 })
 setSaved(true)
 setTimeout(() => setSaved(false), 2000)
 } catch (err) {
 console.error(err)
 } finally {
 setIsSaving(false)
 }
 }

 return (
 <div className="h-screen flex flex-col p-4">
 <header className="flex justify-between items-center mb-4">
 <h1 className="text-2xl font-bold">Chapter Editor</h1>
 <div className="space-x-2">
 <Button onClick={handleSave} disabled={isSaving}>
 {isSaving ? "Saving..." : saved ? "Saved!" : "Save"}
 </Button>
 </div>
 </header>
 
 <main className="flex-1 grid grid-cols-1">
 <Card className="p-4">
 <TiptapEditor content={content} onChange={setContent} />
 </Card>
 </main>
 
 <footer className="text-sm text-gray-500 mt-2">
 Chapter ID: {chId}
 </footer>
 </div>
 )
}

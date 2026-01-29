"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Loader2, Link, Upload } from "lucide-react"
import { createVideo } from "@/app/actions/videos"
import { enviarNotificacionMasiva, enviarVideoATelegram } from "@/app/actions/telegram"

type TipoVideo = 'link' | 'file'

export function VideoForm() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [tipoVideo, setTipoVideo] = useState<TipoVideo>('link')

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setMessage(null)
      formData.set("tipo_video", tipoVideo)
      
      const result = await createVideo(formData)
      
      if (result.error) {
        setMessage({ type: "error", text: result.error })
        return
      }
      
      if (result.data) {
        // Enviar notificación según el tipo de video
        if (tipoVideo === 'file' && result.data.url_video) {
          // Enviar video como archivo a Telegram
          await enviarVideoATelegram(result.data.id, result.data.titulo, result.data.url_video)
        } else {
          // Enviar notificación con link
          await enviarNotificacionMasiva(result.data.id, result.data.titulo, result.data.url_video)
        }
        
        const expiraMsg = tipoVideo === 'file' ? " (el video se eliminará en 7 días)" : ""
        setMessage({ type: "success", text: `Video creado y notificaciones enviadas${expiraMsg}` })
        
        // Limpiar formulario
        const form = document.getElementById("video-form") as HTMLFormElement
        form?.reset()
        setTipoVideo('link')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Nuevo Video
        </CardTitle>
        <CardDescription>
          Agrega un video y notifica automáticamente a todos los usuarios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="video-form" action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Título del Video</Label>
            <Input
              id="titulo"
              name="titulo"
              placeholder="Ej: Capacitación de Seguridad"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Video</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tipoVideo === 'link' ? 'default' : 'outline'}
                onClick={() => setTipoVideo('link')}
                className="flex-1"
              >
                <Link className="mr-2 h-4 w-4" />
                Link (TikTok, YouTube)
              </Button>
              <Button
                type="button"
                variant={tipoVideo === 'file' ? 'default' : 'outline'}
                onClick={() => setTipoVideo('file')}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Subir Archivo
              </Button>
            </div>
          </div>
          
          {tipoVideo === 'link' ? (
            <div className="space-y-2">
              <Label htmlFor="url_video">URL del Video</Label>
              <Input
                id="url_video"
                name="url_video"
                type="url"
                placeholder="https://tiktok.com/@usuario/video/..."
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="video_file">Archivo de Video</Label>
              <Input
                id="video_file"
                name="video_file"
                type="file"
                accept="video/*"
                required
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ El video se enviará directo a Telegram y se eliminará del servidor en 7 días.
                Máximo 50MB para Telegram.
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción (Opcional)</Label>
            <Textarea
              id="descripcion"
              name="descripcion"
              placeholder="Instrucciones adicionales..."
              rows={3}
            />
          </div>
          
          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === "success"
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
              }`}
            >
              {message.text}
            </div>
          )}
          
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tipoVideo === 'file' ? 'Subiendo video...' : 'Creando...'}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Crear Video y Notificar
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

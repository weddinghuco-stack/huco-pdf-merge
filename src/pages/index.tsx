"use client";

import { useState, useCallback, useRef } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { FileUp, Trash2, Download, Loader2, Archive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InstallPrompt } from "@/components/install-prompt";
import { AnimatePresence, motion, MotionNodeAnimationOptions, Variant } from "motion/react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
interface PDFFile {
  id: string;
  arrayBuffer: ArrayBuffer;
  name: string;
  pageCount: number;
}

interface ZipGroup {
  id: string;
  name: string;
  files: PDFFile[];
  totalPages: number;
}
const animVariants: Record<string, MotionNodeAnimationOptions> = {
  fadeDown: {
    initial: {
      opacity: 0,
      y: -20
    },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "spring" } as const
  },
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "spring" } as const
  },
  fadeLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "spring" } as const
  },
  fadeRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "tween" } as const
  }
};
export default function Home() {
  const [zipGroups, setZipGroups] = useState<ZipGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergingProgress, setMergingProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;

    setIsLoading(true);
    const newZipGroups: ZipGroup[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.name.endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed") {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const pdfFiles: PDFFile[] = [];

          for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir && filename.toLowerCase().endsWith(".pdf")) {
              try {
                const pdfBuffer = await zipEntry.async("arraybuffer");
                const pdfDoc = await PDFDocument.load(pdfBuffer);
                const pageCount = pdfDoc.getPageCount();

                pdfFiles.push({
                  id: `${Date.now()}-${i}-${filename}`,
                  arrayBuffer: pdfBuffer,
                  name: filename,
                  pageCount
                });
              } catch (error) {
                console.error(`Error loading PDF from zip: ${filename}`, error);
              }
            }
          }

          if (pdfFiles.length > 0) {
            pdfFiles.sort((a, b) => a.name.localeCompare(b.name));

            newZipGroups.push({
              id: `${Date.now()}-${i}`,
              name: file.name,
              files: pdfFiles,
              totalPages: pdfFiles.reduce((sum, f) => sum + f.pageCount, 0)
            });
          } else {
            toast.error(`Tidak ada file PDF dalam folder ZIP : ${file.name}`);

            continue; // tetap lanjut ke file berikutnya
          }
        } catch (error) {
          toast.error(`Error loading ZIP: ${file.name}`);
          console.error(`Error loading ZIP: ${file.name}`, error);
        }
      } else {
        toast.error(`File is not a ZIP: ${file.name}`);
      }
    }

    // update state sekali di akhir
    if (newZipGroups.length > 0) {
      setZipGroups((prev) => [...prev, ...newZipGroups]);
    }

    // reset input supaya user bisa upload file sama lagi
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setIsLoading(false);
  }, []);
  const removeZipGroup = (id: string) => {
    setZipGroups((prev) => prev.filter((g) => g.id !== id));
  };

  const mergeAndExportZip = async () => {
    if (zipGroups.length < 2) return;

    // Set loading state IMMEDIATELY
    setIsMerging(true);
    setMergingProgress("Memulai proses merge...");

    // Use setTimeout to ensure UI updates before heavy processing
    setTimeout(async () => {
      try {
        const outputZip = new JSZip();
        const maxFiles = Math.max(...zipGroups.map((g) => g.files.length));

        for (let i = 0; i < maxFiles; i++) {
          setMergingProgress(`Menggabungkan file ${i + 1} dari ${maxFiles}...`);

          // Allow UI to update
          await new Promise((resolve) => setTimeout(resolve, 0));

          const mergedPdf = await PDFDocument.create();
          let hasContent = false;

          for (const group of zipGroups) {
            if (i < group.files.length) {
              const pdfFile = group.files[i];
              const pdfDoc = await PDFDocument.load(pdfFile.arrayBuffer);
              const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));
              hasContent = true;
            }
          }

          if (hasContent) {
            const mergedPdfBytes = await mergedPdf.save();
            const baseFilename = zipGroups[0].files[i]?.name || `merged-${i + 1}.pdf`;
            const filename = baseFilename.replace(/\.pdf$/i, "") + "-merged.pdf";
            outputZip.file(filename, mergedPdfBytes);
          }
        }

        setMergingProgress("Membuat file ZIP...");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const zipBlob = await outputZip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        });

        setMergingProgress("Mengunduh file...");
        await new Promise((resolve) => setTimeout(resolve, 100));

        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "merged-pdfs.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setMergingProgress("Selesai! ✓");
        toast.success("Selesai! ✓");
        setTimeout(() => {
          setMergingProgress("");
          setIsMerging(false);
        }, 1500);
      } catch (e) {
        console.error("Error merging PDFs:", e);
        setMergingProgress("");
        setIsMerging(false);
      }
    }, 10);
  };
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.2 // jeda tiap kata 0.2 detik
      }
    }
  };

  const itemVariants: Record<string, Variant> = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };
  const totalFiles = zipGroups.reduce((sum, g) => sum + g.files.length, 0);
  const totalPages = zipGroups.reduce((sum, g) => sum + g.totalPages, 0);
  const text = "beberapa file PDF dari ZIP menjadi satu dengan".split(" ");
  return (
    <main className='w-full bg-background  items-start min-h-screen justify-center flex'>
      <InstallPrompt />
      <div className='container flex flex-col mx-auto px-4 py-12 w-full  max-w-3xl min-h-screen'>
        <div className='text-center mb-10 flex-0 '>
          <motion.h1
            initial={animVariants.fadeDown.initial}
            animate={animVariants.fadeDown.animate}
            transition={{
              ...animVariants.fadeDown.transition,
              duration: 0.5
            }}
            className='text-4xl font-bold text-foreground mb-3 text-balance uppercase'
          >
            PDF <span className='text-primary/50'> Merger</span>
          </motion.h1>
          <div className='text-muted-foreground text-xs md:text-lg inline-flex gap-1'>
            <motion.div className='text-primary' animate={animVariants.fadeRight.animate} transition={{ ...animVariants.fadeRight.transition, delay: 1 }} initial={animVariants.fadeRight.initial}>
              Gabungkan
            </motion.div>
            <motion.div className='' variants={containerVariants} initial='hidden' animate='show'>
              {text.map((word, i) => (
                <motion.span key={i} variants={itemVariants} className='mr-1 inline-block'>
                  {word}
                </motion.span>
              ))}
            </motion.div>
            <motion.div className='text-primary' animate={animVariants.fadeLeft.animate} transition={{ ...animVariants.fadeLeft.transition, delay: 1 }} initial={animVariants.fadeLeft.initial}>
              Mudah
            </motion.div>
          </div>
        </div>

        <div className='flex-1items-center justify-center h-full flex flex-col'>
          <Card className='mb-6 '>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <motion.div
                  animate={{ y: [-10, 0], rotate: [-25, 25, 0, -25, 25, 0] }} // kiri → tengah → kanan → tengah
                  transition={{
                    duration: 1, // total durasi satu siklus
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1],
                    repeatDelay: 4,
                    repeatType: "loop"
                  }}
                  className=''
                >
                  <FileUp className='h-5 w-5' />
                </motion.div>
                Upload ZIP Files
              </CardTitle>
              <CardDescription>Pilih atau drag & drop file ZIP yang berisi PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <label
                className='flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors'
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileUpload(e.dataTransfer.files);
                }}
              >
                <div className='flex flex-col items-center justify-center pt-5 pb-6'>
                  {isLoading ? <Loader2 className='h-10 w-10 text-muted-foreground animate-spin mb-3' /> : <Archive className='h-10 w-10 text-muted-foreground mb-3' />}
                  <p className='mb-2 text-sm text-muted-foreground'>
                    <span className='font-semibold'>Klik untuk upload</span> atau drag & drop
                  </p>
                  <p className='text-xs text-muted-foreground'>Hanya file ZIP</p>
                </div>
                <input type='file' ref={fileInputRef} className='hidden' accept='.zip,application/zip,application/x-zip-compressed' multiple onChange={(e) => handleFileUpload(e.target.files)} />
              </label>
            </CardContent>
          </Card>
          <AnimatePresence mode='wait' initial={false}>
            {zipGroups.length > 0 && (
              <motion.div initial='hidden' animate='visible' variants={containerVariants} className='mb-6'>
                <Card className='mb-6'>
                  <CardHeader>
                    <CardTitle className='flex items-center justify-between'>
                      <span className='flex items-center gap-2'>
                        <Archive className='h-5 w-5' />
                        File ZIP ({zipGroups.length})
                      </span>
                      <span className='text-sm font-normal text-muted-foreground'>
                        Total: {totalFiles} PDF • {totalPages} halaman
                      </span>
                    </CardTitle>
                    <CardDescription>File ZIP yang berisi PDF</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className='space-y-2'>
                      {zipGroups.map((group) => (
                        <li key={group.id} className='flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border transition-all'>
                          <div className='flex items-center justify-center h-8 w-8 bg-primary/10 rounded shrink-0'>
                            <Archive className='h-4 w-4 text-primary' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium truncate'>{group.name}</p>
                            <p className='text-xs text-muted-foreground'>
                              {group.files.length} file PDF • {group.totalPages} halaman
                            </p>
                          </div>
                          <Button variant='ghost' size='icon' className='shrink-0 text-muted-foreground hover:text-destructive' onClick={() => removeZipGroup(group.id)}>
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <Button onClick={mergeAndExportZip} disabled={zipGroups.length < 2 || isMerging} className='w-fit self-end flex place-self-end h-12 text-base' size='lg'>
            {isMerging ? (
              <>
                <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                {mergingProgress || "Menggabungkan..."}
              </>
            ) : (
              <>
                <Download className='mr-2 h-5 w-5' />
                Gabungkan {zipGroups.length > 0 ? `${zipGroups.length} ZIP` : "PDF"}
              </>
            )}
          </Button>
        </div>

        {zipGroups.length === 1 && <p className='text-center text-sm text-muted-foreground mt-3'>Tambahkan minimal 2 file ZIP untuk menggabungkan</p>}
        <motion.div className='flex absolute left-0 bottom-0 px-2 gap-2 items-end text-muted-foreground'>
          Made with by
          <Link target='_blank' href='https://muhammadhilmanhumaini.vercel.app'>
            HUCO PROJECT
          </Link>
          <Link target='_blank' href='https://muhammadhilmanhumaini.vercel.app' className='relative  md:size-8  size-8 rounded-full bg-white '>
            <Image className='flex p-1' src={"/icons/HUCO-512x512.png"} alt='HUCO-512x512' fill></Image>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}

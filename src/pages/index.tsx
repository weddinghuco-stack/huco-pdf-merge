"use client";

import { useState, useCallback, useRef } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { FileUp, Trash2, Download, Loader2, Archive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { AnimatePresence, motion, MotionNodeAnimationOptions, Variant, Variants } from "motion/react";
import { toast } from "sonner";

import { InstallPrompt } from "@/src/components/install-prompt";
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
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "spring" }
  },
  fadeLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "spring" }
  },
  fadeRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.5, ease: "easeOut", type: "tween" }
  }
};
const itemVariants: Record<string, Variant> = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

interface UnmatchedFile {
  fileId: string;
  fileName: string;
  zipName: string;
  zipIndex: number;
  file: PDFFile;
}

export default function Home() {
  const [zipGroups, setZipGroups] = useState<ZipGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergingProgress, setMergingProgress] = useState<string>("");
  const [unmatchedFiles, setUnmatchedFiles] = useState<UnmatchedFile[]>([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    if (files.length > 2) {
      toast.error("Maksimal upload 2 file ZIP!");
      return;
    }
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
                toast.error(`Error loading PDF: ${filename}`);
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
            toast.error(`Tidak ada file PDF dalam ZIP: ${file.name}`);
          }
        } catch (error) {
          toast.error(`Error loading ZIP: ${file.name}`);
        }
      } else {
        toast.error(`File is not a ZIP: ${file.name}`);
      }
    }

    if (newZipGroups.length > 0) {
      setZipGroups((prev) => [...prev, ...newZipGroups]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setIsLoading(false);
  }, []);

  const removeZipGroup = (id: string) => {
    setZipGroups((prev) => prev.filter((g) => g.id !== id));
  };

  // Fungsi untuk mengekstrak ID unik dari nama file
  const extractFileId = (filename: string): string => {
    const nameWithoutExt = filename.replace(/\.pdf$/i, "");
    const match = nameWithoutExt.match(/\d+[A-Z]\d+[A-Z]\d+/);
    if (match) return match[0];
    return nameWithoutExt.trim().split(" ").pop() || nameWithoutExt;
  };

  const mergeAndExportZip = async () => {
    if (zipGroups.length < 2) return;

    setIsMerging(true);
    setMergingProgress("Memulai proses matching...");

    setTimeout(async () => {
      try {
        // Buat mapping dari file ID ke file dari setiap ZIP
        const filesByZipAndId = new Map<string, Map<string, PDFFile>>();

        zipGroups.forEach((group) => {
          const filesMap = new Map<string, PDFFile>();

          group.files.forEach((file) => {
            const fileId = extractFileId(file.name);
            filesMap.set(fileId, file);
          });

          filesByZipAndId.set(group.id, filesMap);
        });

        // Kumpulkan semua unique file IDs
        const allFileIds = new Set<string>();
        filesByZipAndId.forEach((filesMap) => {
          filesMap.forEach((_, fileId) => {
            allFileIds.add(fileId);
          });
        });

        // Buat hasil matching
        const matchResults: Array<{
          fileId: string;
          matchedFiles: Array<{ zipIndex: number; zipName: string; fileName: string; file: PDFFile }>;
          willMerge: boolean;
        }> = [];

        allFileIds.forEach((fileId) => {
          const matchedFiles: Array<{ zipIndex: number; zipName: string; fileName: string; file: PDFFile }> = [];

          zipGroups.forEach((group, zipIndex) => {
            const filesMap = filesByZipAndId.get(group.id);
            const file = filesMap?.get(fileId);

            if (file) {
              matchedFiles.push({
                zipIndex,
                zipName: group.name,
                fileName: file.name,
                file: file
              });
            }
          });

          const willMerge = matchedFiles.length >= 2;
          matchResults.push({ fileId, matchedFiles, willMerge });
        });

        const willBeMerged = matchResults.filter((r) => r.willMerge).length;

        // Kumpulkan file yang tidak match
        const unmatched: UnmatchedFile[] = [];
        matchResults.forEach((result) => {
          if (!result.willMerge && result.matchedFiles.length > 0) {
            const match = result.matchedFiles[0];
            unmatched.push({
              fileId: result.fileId,
              fileName: match.fileName,
              zipName: match.zipName,
              zipIndex: match.zipIndex,
              file: match.file
            });
          }
        });

        setUnmatchedFiles(unmatched);

        if (willBeMerged === 0) {
          toast.error("Tidak ada file yang bisa di-merge!");
          setMergingProgress("");
          setIsMerging(false);
          setShowUnmatched(true);
          return;
        }

        // MULAI PROSES MERGE
        setMergingProgress("Menggabungkan PDF...");

        const outputZip = new JSZip();
        const filesToMerge = matchResults.filter((r) => r.willMerge);

        for (let i = 0; i < filesToMerge.length; i++) {
          const result = filesToMerge[i];
          setMergingProgress(`Menggabungkan ${i + 1}/${filesToMerge.length}: ${result.fileId}`);

          await new Promise((resolve) => setTimeout(resolve, 10));

          try {
            const mergedPdf = await PDFDocument.create();

            // Sort by zipIndex untuk urutan ZIP 1 -> ZIP 2 -> ZIP 3...
            const sortedMatches = [...result.matchedFiles].sort((a, b) => a.zipIndex - b.zipIndex);

            // Gabungkan PDF dengan urutan: ZIP 1 di atas, ZIP 2 di bawah
            for (const match of sortedMatches) {
              const pdfDoc = await PDFDocument.load(match.file.arrayBuffer);
              const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
              copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfBytes = await mergedPdf.save();

            const filename = `${result.fileId}-merged.pdf`;

            outputZip.file(filename, mergedPdfBytes);
          } catch (error) {
            toast.error(`Error merging ${result.fileId}`);
          }
        }

        // BUAT DAN DOWNLOAD ZIP
        setMergingProgress("Membuat file ZIP...");

        const zipBlob = await outputZip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        });

        setMergingProgress("📥 Mengunduh...");

        // DOWNLOAD
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "merged-pdfs.zip";
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);

        setMergingProgress("Selesai! ✓");
        toast.success(`Berhasil merge ${willBeMerged} file!`);

        // Clear input dan ZIP groups setelah merge berhasil
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setZipGroups([]);
        setShowUnmatched(unmatched.length > 0);

        setTimeout(() => {
          setMergingProgress("");
          setIsMerging(false);
        }, 2000);
      } catch (e) {
        setMergingProgress("");
        setIsMerging(false);
        toast.error("Error saat proses merge");
      }
    }, 10);
  };

  const downloadUnmatchedFiles = async () => {
    if (unmatchedFiles.length === 0) return;

    try {
      toast.info("Membuat ZIP file yang tidak match...");
      const outputZip = new JSZip();

      unmatchedFiles.forEach((item) => {
        outputZip.file(item.fileName, item.file.arrayBuffer);
      });

      const zipBlob = await outputZip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "unmatched-files.zip";
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);

      toast.success(`Download ${unmatchedFiles.length} file yang tidak match!`);
    } catch (error) {
      toast.error("Gagal download file yang tidak match");
    }
  };

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const totalFiles = zipGroups.reduce((sum, g) => sum + g.files.length, 0);
  const totalPages = zipGroups.reduce((sum, g) => sum + g.totalPages, 0);
  const text = "beberapa file PDF dari ZIP menjadi satu dengan".split(" ");

  return (
    <main className='w-full bg-background items-start min-h-svh justify-center flex'>
      <div className='container flex flex-col mx-auto px-4 py-12 w-full max-w-3xl min-h-svh'>
        <div className='text-center mb-10 flex-0'>
          <motion.h1 initial={animVariants.fadeDown.initial} animate={animVariants.fadeDown.animate} transition={animVariants.fadeDown.transition} className='text-4xl font-bold text-foreground mb-3 text-balance uppercase'>
            PDF <span className='text-primary/50'>Merger</span>
          </motion.h1>
          <div className='text-muted-foreground text-xs md:text-lg inline-flex gap-1 flex-wrap justify-center'>
            <motion.div className='text-primary' animate={animVariants.fadeRight.animate} transition={{ ...animVariants.fadeRight.transition, delay: 1 }} initial={animVariants.fadeRight.initial}>
              Gabungkan
            </motion.div>
            <motion.div variants={containerVariants} initial='hidden' animate='show'>
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

        <div className='flex-1 items-center justify-center h-full flex flex-col'>
          <Card className='mb-6 w-full'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <motion.div
                  animate={{ y: [-10, 0], rotate: [-25, 25, 0, -25, 25, 0] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1],
                    repeatDelay: 4,
                    repeatType: "loop"
                  }}
                >
                  <FileUp className='h-5 w-5' />
                </motion.div>
                Upload ZIP Files
              </CardTitle>
              <CardDescription>
                Pilih atau drag & drop file ZIP yang berisi PDF <br /> Maks file ZIP = 2
              </CardDescription>
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
              <motion.div initial='hidden' animate='visible' variants={containerVariants} className='mb-6 w-full'>
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

        {/* Tampilkan File yang Tidak Match */}
        <AnimatePresence mode='wait'>
          {showUnmatched && unmatchedFiles.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className='w-full mt-6'>
              <Card className='border-yellow-500/50 bg-yellow-500/5'>
                <CardHeader>
                  <CardTitle className='flex items-center justify-between'>
                    <span className='flex items-center gap-2 text-yellow-600 dark:text-yellow-500'>
                      <Archive className='h-5 w-5' />
                      File Tidak Match ({unmatchedFiles.length})
                    </span>
                    <Button variant='outline' size='sm' onClick={() => setShowUnmatched(false)} className='text-xs'>
                      Tutup
                    </Button>
                  </CardTitle>
                  <CardDescription>File ini tidak memiliki pasangan di ZIP lain dan tidak di-merge</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2 mb-4 max-h-64 overflow-y-auto'>
                    {unmatchedFiles.map((item, idx) => (
                      <div key={idx} className='flex items-center gap-3 p-2 bg-background rounded border border-border'>
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium truncate'>{item.fileName}</p>
                          <p className='text-xs text-muted-foreground'>
                            Dari: {item.zipName} • ID: {item.fileId} • {item.file.pageCount} hal
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={downloadUnmatchedFiles} variant='outline' className='w-full border-yellow-500/50 hover:bg-yellow-500/10'>
                    <Download className='mr-2 h-4 w-4' />
                    Download {unmatchedFiles.length} File Tidak Match
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        <div className='absolute right-0 bottom-0 z-50 text-primary text-xs flex items-end gap-2 md:text-2xl font-extralight pr-2 pb-2 md:p-10  '>
          <Link href={"https://muhammadhilmanhumaini.vercel.app"} target='_blank' className='font-extralight !!text-primary-foreground'>
            Made with ❤️ by Muhammad Hilman Humaini
          </Link>
        </div>
      </div>
    </main>
  );
}

/** Export menu: PDF (print), Word, and our JSON format. */
import { useState } from 'react';
import { ChevronDown, Download, FileCode2, FileText, FileType2 } from 'lucide-react';
import type { Resume } from '@shared/types';
import { Button, Menu, MenuGroupLabel, MenuItem, useToast } from '@/components/ui';
import { exportDocx, exportJson, exportPdf } from '@/lib/export';

export interface ExportMenuProps {
  resume: Resume;
  size?: 'sm' | 'md';
}

export function ExportMenu({ resume, size = 'md' }: ExportMenuProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (label: string, fn: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.push({
        title: `${label} export failed`,
        description: (e as Error)?.message || 'Something went wrong while building the file.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Menu
      label="Export resume"
      align="end"
      trigger={
        <Button
          variant="primary"
          size={size}
          loading={busy}
          leftIcon={<Download size={15} />}
          rightIcon={<ChevronDown size={14} />}
        >
          Export
        </Button>
      }
    >
      <MenuGroupLabel>Download</MenuGroupLabel>
      <MenuItem icon={<FileText size={15} />} onSelect={() => void run('PDF', () => exportPdf(resume))}>
        PDF
      </MenuItem>
      <MenuItem icon={<FileType2 size={15} />} onSelect={() => void run('Word', () => exportDocx(resume))}>
        Word (.docx)
      </MenuItem>
      <MenuItem icon={<FileCode2 size={15} />} onSelect={() => void run('JSON', () => exportJson(resume))}>
        JSON
      </MenuItem>
    </Menu>
  );
}

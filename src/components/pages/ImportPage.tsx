import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle } from "lucide-react";

export function ImportPage() {
  const [isDragActive, setIsDragActive] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">Bulk import contacts from CSV or Excel files</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CSV/Excel Import</CardTitle>
              <CardDescription>Drag & drop or select a file to import contacts</CardDescription>
            </div>
            <Badge>Phase 4</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragEnter={() => setIsDragActive(true)}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={() => setIsDragActive(false)}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium mb-1">Drag files here or click to browse</p>
            <p className="text-sm text-muted-foreground mb-4">Supported: CSV, Excel (.xlsx), Google Sheets</p>
            <Button disabled>Select File</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Auto-column detection</p>
              <p className="text-xs text-muted-foreground">Automatically map CSV columns to contact fields</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Deduplication</p>
              <p className="text-xs text-muted-foreground">Identify duplicates by email or LinkedIn URL</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Batch tagging</p>
              <p className="text-xs text-muted-foreground">Tag all imported contacts with source info</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Preview & validation</p>
              <p className="text-xs text-muted-foreground">Review changes before committing the import</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sample CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md text-sm font-mono text-xs overflow-x-auto">
            <pre>{`name,email,phone,company,role,contact_type
Jane Smith,jane@example.com,+1-555-0100,Acme Corp,Engineering Manager,recruiter
John Doe,john@example.com,+1-555-0101,TechCorp,Senior Engineer,referral`}</pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle, Download } from "lucide-react";
import {
  parseCSVFile,
  detectColumnMappings,
  mapRowToContact,
  findDuplicates,
  validateContacts,
  generateImportSummary,
  downloadTemplate,
  type CSVRow,
  type MappingConfig,
  type ContactPreview,
} from "@/lib/csv-utils";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

export function ImportPage() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragActive, setIsDragActive] = useState(false);
  const [csvRows, setCSVRows] = useState<CSVRow[]>([]);
  const [csvColumns, setCSVColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappingConfig>({});
  const [contacts, setContacts] = useState<ContactPreview[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importTag, setImportTag] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    duplicates: number;
    errors: number;
  } | null>(null);

  const handleFileUpload = async (file: File) => {
    try {
      const { rows, columns } = await parseCSVFile(file);
      setCSVRows(rows);
      setCSVColumns(columns);

      // Auto-detect mappings
      const detectedMapping = detectColumnMappings(columns);
      setMapping(detectedMapping);

      // Move to mapping step
      setStep("mapping");
      toast.success(`Loaded ${rows.length} rows from CSV`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleProceedToPreview = async () => {
    try {
      // Convert CSV rows to contacts using mapping
      const mappedContacts = csvRows.map((row) =>
        mapRowToContact(row, mapping)
      );

      // Get existing emails from database
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("email");

      const existingEmails = new Set(
        (existingContacts || [])
          .map((c: any) => c.email?.toLowerCase())
          .filter(Boolean)
      );

      // Find duplicates
      const contactsWithDupes = findDuplicates(mappedContacts, existingEmails);

      // Validate
      const { valid, invalid } = validateContacts(contactsWithDupes);

      setContacts(valid);
      const invalidMessages = invalid.map((i) => `${i.contact.name}: ${i.error}`);
      setValidationErrors(invalidMessages);

      if (invalidMessages.length > 0) {
        toast.warning(`${invalidMessages.length} rows have validation errors`);
      }

      setStep("preview");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleImport = async () => {
    if (contacts.length === 0) {
      toast.error("No valid contacts to import");
      return;
    }

    setImporting(true);
    try {
      let created = 0;
      let duplicates = 0;
      let errors = 0;

      for (const contact of contacts) {
        try {
          const { error } = await supabase.from("contacts").insert({
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || null,
            company_name: contact.company_name || null,
            role: contact.role || null,
            contact_type: contact.contact_type,
            notes: contact.notes || null,
            user_id: DEFAULT_USER_ID,
            status: "active",
          });

          if (error) {
            if (error.message.includes("duplicate")) {
              duplicates++;
            } else {
              errors++;
              console.error(`Import error for ${contact.name}:`, error);
            }
          } else {
            created++;
          }
        } catch (err) {
          errors++;
        }
      }

      setImportResult({ created, duplicates, errors });
      setStep("complete");
      toast.success(`Imported ${created} contacts`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Contacts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk import contacts from CSV or Excel files
        </p>
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>CSV/Excel Import</CardTitle>
                  <CardDescription>
                    Drag & drop or select a file to import contacts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-1">
                  Drag files here or click to browse
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Supported: CSV, Excel (.xlsx)
                </p>
                <label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <Button asChild>
                    <span>Select File</span>
                  </Button>
                </label>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => downloadTemplate()}
              >
                <Download className="h-4 w-4 mr-2" /> Download Template
              </Button>
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
                  <p className="text-xs text-muted-foreground">
                    Automatically map CSV columns to contact fields
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Deduplication</p>
                  <p className="text-xs text-muted-foreground">
                    Identify duplicates by email
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Preview & validation</p>
                  <p className="text-xs text-muted-foreground">
                    Review changes before importing
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 2: Column Mapping */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle>Map CSV Columns</CardTitle>
            <CardDescription>
              Match your CSV columns to contact fields
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {csvColumns.map((col) => (
                <div key={col} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label className="text-xs">CSV Column: {col}</Label>
                    <div className="text-sm font-medium bg-muted p-2 rounded mt-1">
                      {col}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Map to</Label>
                    <Select
                      value={mapping[col] || ""}
                      onValueChange={(val) => {
                        setMapping({
                          ...mapping,
                          [col]: val || null,
                        });
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Skip this column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Skip</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="company_name">Company</SelectItem>
                        <SelectItem value="role">Role</SelectItem>
                        <SelectItem value="contact_type">Type</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleProceedToPreview}>
                Review Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Preview Contacts</CardTitle>
              <CardDescription>
                {contacts.length} valid contacts ready to import
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Email</th>
                      <th className="px-4 py-2 text-left font-medium">Company</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.slice(0, 10).map((contact, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/50">
                        <td className="px-4 py-2">{contact.name}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {contact.email || "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {contact.company_name || "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{contact.contact_type}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contacts.length > 10 && (
                  <div className="p-4 text-center text-sm text-muted-foreground bg-muted">
                    +{contacts.length - 10} more contacts...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {validationErrors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <CardTitle className="text-red-900">
                      {validationErrors.length} Errors Found
                    </CardTitle>
                    <CardDescription>
                      These rows will be skipped
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-red-900">
                  {validationErrors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                  {validationErrors.length > 5 && (
                    <li>• +{validationErrors.length - 5} more errors...</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("mapping")}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={handleImport}
              disabled={importing || contacts.length === 0}
            >
              {importing ? "Importing..." : `Import ${contacts.length} Contacts`}
            </Button>
          </div>
        </>
      )}

      {/* Step 4: Complete */}
      {step === "complete" && importResult && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">
              ✓ Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-2xl font-bold text-green-600">
                  {importResult.created}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {importResult.duplicates}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">
                  {importResult.errors}
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => {
                setStep("upload");
                setContacts([]);
                setValidationErrors([]);
                setImportResult(null);
              }}
            >
              Import More Contacts
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

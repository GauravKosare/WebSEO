import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type ReportIssue = { id?: string; severity?: string; category?: string; title?: string; detail?: string };
type ReportScan = {
  _id: unknown;
  url: string;
  finalUrl?: string;
  score: number;
  issues?: ReportIssue[];
  pageSpeed?: { performanceScore?: number | null; seoScore?: number | null; accessibilityScore?: number | null };
  readability?: { fleschScore?: number | null };
  aiContent?: { title?: string; metaDescription?: string; h1?: string; summary?: string };
  keywordIdeas?: { keyword?: string; intent?: string; estimatedDifficulty?: string; reason?: string }[];
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#171717" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  brand: { fontSize: 16, fontWeight: 700 },
  url: { fontSize: 11, marginTop: 4, color: "#404040" },
  date: { fontSize: 9, marginTop: 2, color: "#737373" },
  scoreBox: { alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 32, border: "3pt solid" },
  scoreText: { fontSize: 22, fontWeight: 700 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  metricsRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  metricBox: { flex: 1, border: "1pt solid #e5e5e5", borderRadius: 6, padding: 8, alignItems: "center" },
  metricValue: { fontSize: 16, fontWeight: 700 },
  metricLabel: { fontSize: 8, color: "#737373", marginTop: 2 },
  issue: { border: "1pt solid #e5e5e5", borderRadius: 4, padding: 8, marginBottom: 6 },
  issueTitle: { fontSize: 10, fontWeight: 700 },
  issueDetail: { fontSize: 9, color: "#404040", marginTop: 2 },
  category: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#737373", marginTop: 10, marginBottom: 4 },
  fieldLabel: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", color: "#737373", marginTop: 8 },
  fieldValue: { fontSize: 10, marginTop: 2 },
  keywordRow: { flexDirection: "row", borderBottom: "1pt solid #e5e5e5", paddingVertical: 4 },
  keywordCell: { fontSize: 9 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: "#a3a3a3", textAlign: "center" },
});

function scoreColor(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function AuditReportDocument({ scan }: { scan: ReportScan }) {
  const grouped = (scan.issues ?? []).reduce<Record<string, ReportIssue[]>>((acc, issue) => {
    (acc[issue.category ?? "Other"] ??= []).push(issue);
    return acc;
  }, {});

  return (
    <Document title={`WebSEO report — ${scan.finalUrl ?? scan.url}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>WebSEO Report</Text>
            <Text style={styles.url}>{scan.finalUrl ?? scan.url}</Text>
            <Text style={styles.date}>Generated {new Date().toLocaleString()}</Text>
          </View>
          <View style={[styles.scoreBox, { borderColor: scoreColor(scan.score) }]}>
            <Text style={[styles.scoreText, { color: scoreColor(scan.score) }]}>{scan.score}</Text>
          </View>
        </View>

        {scan.pageSpeed && (
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{scan.pageSpeed.performanceScore ?? "—"}</Text>
              <Text style={styles.metricLabel}>Performance</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{scan.pageSpeed.seoScore ?? "—"}</Text>
              <Text style={styles.metricLabel}>SEO (Lighthouse)</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{scan.pageSpeed.accessibilityScore ?? "—"}</Text>
              <Text style={styles.metricLabel}>Accessibility</Text>
            </View>
            {scan.readability && (
              <View style={styles.metricBox}>
                <Text style={styles.metricValue}>{scan.readability.fleschScore ?? "—"}</Text>
                <Text style={styles.metricLabel}>Readability</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Issues found ({(scan.issues ?? []).length})</Text>
        {Object.entries(grouped).map(([category, issues]) => (
          <View key={category}>
            <Text style={styles.category}>{category}</Text>
            {(issues ?? []).map((issue, i) => (
              <View key={i} style={styles.issue}>
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <Text style={styles.issueDetail}>{issue.detail}</Text>
              </View>
            ))}
          </View>
        ))}
        {(scan.issues ?? []).length === 0 && <Text style={styles.issueDetail}>No issues found.</Text>}

        {scan.aiContent && (
          <View break>
            <Text style={styles.sectionTitle}>AI-written fixes</Text>
            <Text style={styles.fieldLabel}>Suggested title</Text>
            <Text style={styles.fieldValue}>{scan.aiContent.title}</Text>
            <Text style={styles.fieldLabel}>Suggested meta description</Text>
            <Text style={styles.fieldValue}>{scan.aiContent.metaDescription}</Text>
            <Text style={styles.fieldLabel}>Suggested H1</Text>
            <Text style={styles.fieldValue}>{scan.aiContent.h1}</Text>
            {scan.aiContent.summary && (
              <>
                <Text style={styles.fieldLabel}>Summary</Text>
                <Text style={styles.fieldValue}>{scan.aiContent.summary}</Text>
              </>
            )}
          </View>
        )}

        {scan.keywordIdeas && scan.keywordIdeas.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Keyword ideas</Text>
            {scan.keywordIdeas.map((k, i) => (
              <View key={i} style={styles.keywordRow}>
                <Text style={[styles.keywordCell, { width: "25%", fontWeight: 700 }]}>{k.keyword}</Text>
                <Text style={[styles.keywordCell, { width: "20%" }]}>{k.intent}</Text>
                <Text style={[styles.keywordCell, { width: "15%" }]}>{k.estimatedDifficulty}</Text>
                <Text style={[styles.keywordCell, { width: "40%" }]}>{k.reason}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generated by WebSEO — automated SEO analysis. Not affiliated with Google.
        </Text>
      </Page>
    </Document>
  );
}

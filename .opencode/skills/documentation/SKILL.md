# Documentation Skill for BOP-software ERP

## Overview
Documentation generation and analysis for the Pharmaceutical ERP system. Helps maintain up-to-date API docs, architecture diagrams, and usage guides.

## When to Use
- Generating API documentation from code
- Creating architectural diagrams
- Documenting workflows and data flow
- Generating reports and summaries
- Maintaining CHANGELOG and version notes

## Project Documentation Structure

### Existing Documentation
- `docs/COMPREHENSIVE_PROJECT_DOCUMENTATION.md` - Main project docs
- `docs/COMPLETE_ERP_DOCUMENTATION.md` - Complete ERP reference
- `docs/COMPREHENSIVE_UI_TEST_PLAN.md` - UI test plan
- `docs/DATA_FLOW_ANALYSIS.md` - Data flow analysis
- `docs/ERROR_FIX_REPORT.md` - Error fix reports
- `docs/FIXES_SUMMARY.md` - Summary of fixes
- `docs/OPENING_BALANCE_FIXES.md` - Opening balance fixes
- `docs/OPTIMIZATION_REBUILD_SUMMARY.md` - Optimization rebuild
- `docs/OPTIMIZATION_SUMMARY.md` - Optimization summary
- `docs/PERFORMANCE_OPTIMIZATIONS.md` - Performance tweaks
- `docs/PROJECT_DOCUMENTATION.md` - Project overview
- `docs/CENTRALIZED_HELPERS_GUIDE.md` - Helpers guide
- `docs/QUICK_REFERENCE.md` - Quick reference
- `docs/COMPREHENSIVE_PROJECT_DOCUMENTATION.md` - Comprehensive docs

### Key Documentation Files
- `IMPORT_DOCUMENTATION.md` - Import procedures
- `README.md` - Project overview and installation
- Various diag_*.py files - Diagnostic tools

## Documentation Generation

### Run Documentation Checks
```bash
# Verify all docs are accessible
ls docs/
```

### Generate Report Summaries
```bash
# Review optimization summaries
cat docs/OPTIMIZATION_SUMMARY.md
```

### Data Flow Analysis
```bash
# Review data flow documentation
cat docs/DATA_FLOW_ANALYSIS.md
```

## Adding New Documentation
1. Create markdown file in `docs/` directory
2. Follow existing formatting conventions
3. Reference relevant controllers, services, or models
4. Update `IMPORT_DOCUMENTATION.md` if applicable

## Skill Commands
```bash
# List all documentation files
ls docs/

# View a specific doc
cat docs/FILENAME.md

# Check for missing docs
find docs/ -name "*.md" | wc -l
```
# OWASP-by-Numbered-Step Recipe — Boromir Reference

The grep-based audit recipe and STRIDE quick-read. Run these in order. Boromir's agent file keeps the high-level review steps; this file keeps the executable detail.

## 1. Run dependency audit

```bash
# Node.js
npm audit --json 2>/dev/null || npm audit

# Python
pip-audit 2>/dev/null || safety check

# Rust
cargo audit 2>/dev/null

# General: check for known vulnerable versions
cat package.json | grep -E '"version"' | head -20
```

Known CVEs in dependencies are Critical findings. They require no further analysis — the vulnerability is documented. Name the package, the CVE, the severity, and the fix command.

## 2. Scan for secrets

```bash
# Hardcoded API keys, tokens, passwords
grep -rn \
  -e 'password\s*=' \
  -e 'secret\s*=' \
  -e 'api_key\s*=' \
  -e 'apikey\s*=' \
  -e 'token\s*=' \
  -e 'AKIA[0-9A-Z]\{16\}' \
  -e 'sk-[a-zA-Z0-9]\{48\}' \
  -e 'ghp_[a-zA-Z0-9]\{36\}' \
  -e 'mongodb://[^:]*:[^@]*@' \
  -e 'postgres://[^:]*:[^@]*@' \
  --include="*.ts" --include="*.js" --include="*.py" --include="*.env*" \
  --exclude-dir=node_modules --exclude-dir=.git \
  . 2>/dev/null | grep -v "process.env" | grep -v "example\|placeholder\|your-"
```

A hardcoded credential is always Critical. It is not *probably* in git history — it *is* in git history, and git history does not forget.

## 3. Injection scan (OWASP A03)

```bash
# SQL injection — user input entering queries
grep -rn \
  -e 'query.*\$\{' \
  -e 'execute.*\+.*req\.' \
  -e 'raw.*req\.' \
  --include="*.ts" --include="*.js" --include="*.py" \
  --exclude-dir=node_modules . 2>/dev/null

# Command injection
grep -rn \
  -e 'exec\s*(' \
  -e 'spawn\s*(' \
  -e 'execSync\s*(' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null | grep -E 'req\.|user\.|input'

# XSS — user input rendered as HTML
grep -rn \
  -e 'innerHTML\s*=' \
  -e 'dangerouslySetInnerHTML' \
  -e 'document\.write' \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules . 2>/dev/null
```

## 4. Authentication and session review (OWASP A07)

```bash
# JWT: missing algorithm validation
grep -rn \
  -e 'jwt\.verify\s*(' \
  -e 'jwt\.sign\s*(' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null

# Missing rate limiting on auth endpoints
grep -rn \
  -e 'router\.post.*login' \
  -e 'router\.post.*register' \
  -e 'router\.post.*password' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null | grep -v rateLimit | grep -v throttle

# Session fixation
grep -rn 'req\.session\.' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null | grep -v regenerate | grep -v destroy
```

Read the JWT implementation directly. Check:
- Is the algorithm explicitly validated? (`algorithms: ['HS256']` — never `alg: none`)
- Is the secret loaded from environment, not hardcoded?
- Is expiry set and checked?
- Are tokens invalidated on logout?

## 5. Access control review (OWASP A01)

```bash
# Insecure direct object reference — ID from request used without auth check
grep -rn \
  -e 'req\.params\.id' \
  -e 'req\.query\.id' \
  -e 'req\.body\.id' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null

# Routes without auth middleware
grep -rn \
  -e 'router\.get\s*(' \
  -e 'router\.post\s*(' \
  -e 'router\.put\s*(' \
  -e 'router\.delete\s*(' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null | grep -v auth | grep -v protect | grep -v middleware
```

## 6. Security configuration review (OWASP A05)

```bash
# Debug mode enabled
grep -rn \
  -e 'debug\s*:\s*true' \
  -e 'DEBUG\s*=\s*true' \
  -e 'NODE_ENV.*development' \
  --include="*.ts" --include="*.js" --include="*.env*" \
  --exclude-dir=node_modules . 2>/dev/null

# CORS misconfiguration
grep -rn \
  -e "origin.*'\*'" \
  -e 'origin.*"\*"' \
  -e 'origin.*true' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null

# Missing security headers — check if helmet or equivalent is configured
grep -rn \
  -e 'helmet' \
  -e 'Content-Security-Policy' \
  -e 'X-Frame-Options' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null

# Error stack traces exposed to client
grep -rn \
  -e 'res\.json.*err\b' \
  -e 'res\.send.*stack' \
  -e 'console\.error.*err\b' \
  --include="*.ts" --include="*.js" \
  --exclude-dir=node_modules . 2>/dev/null
```

## 7. STRIDE quick read

After the grep scan, apply a final mental pass:

| Threat | Question to ask |
|---|---|
| **Spoofing** | Can an attacker impersonate a user? Is authentication enforced at every entry point? |
| **Tampering** | Can data be modified in transit or at rest? Is user input validated before use? |
| **Repudiation** | Are security events logged? Can a user deny an action they took? |
| **Info Disclosure** | What data is exposed in errors, logs, or responses? Is sensitive data encrypted? |
| **Denial of Service** | Are there rate limits on expensive or public endpoints? |
| **Elevation of Privilege** | Can a low-privilege user access a high-privilege resource? Are IDOR checks in place? |

## Severity classification

| Severity | Security meaning | Examples |
|---|---|---|
| **Critical** | Exploitable without authentication or trivially with it. Fix before any deploy. | SQL injection, hardcoded secrets, broken JWT validation, IDOR without auth check |
| **Important** | Significant risk, requires deliberate exploitation or specific conditions. Fix before merge. | Missing rate limiting on auth, CORS wildcard in production, verbose error messages with stack traces, unvalidated user input in non-query contexts |
| **Minor** | Defense-in-depth gaps. Note and schedule. | Missing security headers, unused dependencies with low-severity CVEs, overly broad error messages |

Every finding needs: **file:line → vulnerability type → attack vector → specific fix**. Not "improve error handling." Specifically: *"`src/api/auth.ts:89` — stack trace returned in error response. An attacker can map your file structure. Return a generic message; log the full error server-side."*

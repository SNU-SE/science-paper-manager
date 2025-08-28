# Science Paper Manager - Vercel 배포 가이드

## 개요

이 가이드는 Science Paper Manager 애플리케이션을 Vercel에 배포하는 단계별 지침을 제공하며, 완전한 데이터베이스 구성과 모든 필요한 통합을 포함합니다.

## 사전 준비사항

배포 프로세스를 시작하기 전에 다음을 준비해주세요:

- [ ] **Vercel 계정**: [vercel.com](https://vercel.com)에서 가입
- [ ] **Supabase 계정**: [supabase.com](https://supabase.com)에서 계정 생성
- [ ] **GitHub 저장소**: 코드가 GitHub에 푸시되어 있어야 함 (권장)
- [ ] **도메인 이름** (선택사항): 커스텀 도메인 설정용

## 1단계: 데이터베이스 설정 (Supabase)

### 1.1 Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com)에 접속하여 로그인
2. "New Project" 클릭
3. 조직 선택
4. 프로젝트 세부사항 입력:
   - **이름**: `science-paper-manager`
   - **데이터베이스 비밀번호**: 강력한 비밀번호 생성 (저장해두세요!)
   - **지역**: 사용자와 가장 가까운 지역 선택
5. "Create new project" 클릭
6. 프로젝트 초기화 대기 (2-3분)

### 1.2 필수 확장 기능 활성화

1. Supabase 대시보드에서 **Database** → **Extensions**로 이동
2. 다음 확장 기능을 검색하여 활성화:
   - `vector` (시맨틱 검색용)
   - `uuid-ossp` (UUID 생성용)

### 1.3 데이터베이스 마이그레이션 실행

1. Supabase 대시보드에서 **SQL Editor**로 이동
2. `database/schema.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 클릭하여 마이그레이션 실행
4. **Database** → **Tables**에서 테이블이 생성되었는지 확인

### 1.4 행 수준 보안(RLS) 구성

1. **Database** → **Tables**에서 각 테이블에 대해:
2. 테이블 이름 클릭 → **Settings** → **Row Level Security**
3. 모든 테이블에 대해 RLS 활성화
4. 필요에 따라 정책 추가 (인증된 사용자를 위한 기본 읽기/쓰기)

### 1.5 데이터베이스 자격 증명 획득

1. **Settings** → **API**로 이동
2. 다음 값들을 복사 (나중에 필요함):
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY`)

## 2단계: 환경 변수 준비

### 2.1 필수 환경 변수

Vercel에서 설정해야 할 환경 변수 목록을 작성:

```bash
# 데이터베이스 구성 (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 인증 (필수)
NEXTAUTH_SECRET=your_random_32_character_secret
NEXTAUTH_URL=https://your-app-name.vercel.app

# Node 환경
NODE_ENV=production
```

### 2.2 선택적 환경 변수

```bash
# AI 서비스 키 (사용자가 앱 내에서도 설정 가능)
OPENAI_API_KEY=sk-your_openai_key
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
XAI_API_KEY=xai-your_xai_key
GEMINI_API_KEY=AIza-your_gemini_key

# Google Drive 통합 (선택사항)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-app-name.vercel.app/api/google-drive/callback

# Zotero 통합 (선택사항)
ZOTERO_API_KEY=your_zotero_api_key
ZOTERO_USER_ID=your_zotero_user_id

# 분석 (선택사항)
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
```

### 2.3 NEXTAUTH_SECRET 생성

보안 시크릿 생성:
```bash
# 옵션 1: OpenSSL 사용
openssl rand -base64 32

# 옵션 2: Node.js 사용
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 옵션 3: 온라인 생성기
# 방문: https://generate-secret.vercel.app/32
```

## 3단계: Vercel에 배포

### 옵션 A: GitHub를 통한 배포 (권장)

#### 3.1 GitHub에 코드 푸시

1. 코드가 GitHub 저장소에 푸시되어 있는지 확인
2. 저장소가 공개되어 있거나 Vercel 액세스 권한이 있는지 확인

#### 3.2 Vercel에 연결

1. [vercel.com](https://vercel.com)에 접속하여 로그인
2. "New Project" 클릭
3. GitHub 저장소 가져오기
4. `science-paper-manager` 폴더를 루트 디렉토리로 선택
5. Vercel이 Next.js 프로젝트를 자동 감지

#### 3.3 빌드 설정 구성

Vercel이 이 설정들을 자동 감지해야 하지만, 확인해주세요:
- **Framework Preset**: Next.js
- **Root Directory**: `science-paper-manager` (하위 폴더인 경우)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm ci`

#### 3.4 환경 변수 추가

1. 배포 구성에서 "Environment Variables" 클릭
2. 2.1단계의 모든 필수 변수 추가
3. 필요에 따라 선택적 변수 추가
4. 올바른 환경(Production, Preview, Development) 선택 확인

#### 3.5 배포

1. "Deploy" 클릭
2. 빌드 완료 대기 (5-10분)
3. Vercel이 배포 URL 제공

### 옵션 B: Vercel CLI를 통한 배포

#### 3.1 Vercel CLI 설치

```bash
npm install -g vercel
```

#### 3.2 Vercel에 로그인

```bash
vercel login
```

#### 3.3 프로젝트 디렉토리로 이동

```bash
cd science-paper-manager
```

#### 3.4 배포

```bash
# 프로덕션 배포
vercel --prod

# 프롬프트 따라하기:
# - Set up and deploy? Yes
# - Which scope? (계정 선택)
# - Link to existing project? No
# - What's your project's name? science-paper-manager
# - In which directory is your code located? ./
```

#### 3.5 CLI를 통한 환경 변수 설정

```bash
# 환경 변수 추가
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production

# 필요에 따라 선택적 변수 추가
vercel env add OPENAI_API_KEY production
```

## 4단계: 배포 후 구성

### 4.1 NEXTAUTH_URL 업데이트

1. 배포 후 `NEXTAUTH_URL` 환경 변수 업데이트
2. 실제 Vercel 배포 URL로 설정
3. 필요시 재배포

### 4.2 커스텀 도메인 구성 (선택사항)

1. Vercel 대시보드에서 프로젝트로 이동
2. **Settings** → **Domains** 클릭
3. 커스텀 도메인 추가
4. DNS 구성 지침 따르기
5. 커스텀 도메인을 사용하도록 `NEXTAUTH_URL` 업데이트

### 4.3 데이터베이스 연결 테스트

1. 배포된 앱 방문
2. 대시보드 액세스 시도
3. 데이터베이스 작업이 작동하는지 확인
4. 오류가 있는지 Vercel 함수 로그 모니터링

### 4.4 AI 서비스 구성 (선택사항)

AI API 키를 환경 변수로 설정하지 않은 경우:
1. 배포된 앱 방문
2. 설정 → AI 구성으로 이동
3. UI를 통해 API 키 추가
4. AI 분석 기능 테스트

## 5단계: 검증 및 테스트

### 5.1 기능 테스트

다음 핵심 기능들을 테스트:
- [ ] 사용자 인증/로그인
- [ ] 논문 업로드 및 관리
- [ ] 검색 기능
- [ ] AI 분석 (구성된 경우)
- [ ] 데이터베이스 작업
- [ ] 성능 모니터링

### 5.2 성능 테스트

1. Vercel Analytics에서 Core Web Vitals 확인
2. 페이지 로드 속도 테스트
3. API 응답 시간 모니터링
4. 함수 로그에서 메모리 사용량 확인

### 5.3 오류 모니터링

1. 오류에 대한 Vercel 함수 로그 확인
2. 오류 경계 테스트
3. 오류 보고가 작동하는지 확인

## 6단계: 모니터링 및 유지보수

### 6.1 Vercel Analytics 활성화

1. Vercel 대시보드에서 프로젝트로 이동
2. **Analytics** 탭 클릭
3. Web Analytics 활성화
4. 성능 메트릭 모니터링

### 6.2 알림 설정

1. 배포 알림 구성
2. 오류율 알림 설정
3. 함수 타임아웃 알림 모니터링

### 6.3 정기 유지보수

- **주간**: 성능 메트릭 확인
- **월간**: 종속성 검토 및 업데이트
- **분기별**: 보안 감사 및 업데이트

## 문제 해결

### 일반적인 문제 및 해결책

#### 빌드 실패

**문제**: 종속성 오류로 빌드 실패
**해결책**: 
```bash
# 캐시 지우고 재설치
rm -rf node_modules package-lock.json
npm install
```

**문제**: 빌드 중 TypeScript 오류
**해결책**: 먼저 로컬에서 TypeScript 오류 확인 및 수정

#### 데이터베이스 연결 문제

**문제**: Supabase에 연결할 수 없음
**해결책**: 
1. 환경 변수가 올바른지 확인
2. Supabase 프로젝트가 활성 상태인지 확인
3. 데이터베이스 URL에 액세스 가능한지 확인

#### 함수 타임아웃

**문제**: AI 분석 함수 타임아웃
**해결책**: 
1. 더 긴 타임아웃을 위해 Vercel Pro로 업그레이드
2. AI 서비스 호출 최적화
3. 요청 큐잉 구현

#### 환경 변수 문제

**문제**: 환경 변수가 작동하지 않음
**해결책**:
1. 올바른 환경에 대해 변수가 설정되었는지 확인
2. 변수 추가 후 재배포
3. 변수 이름이 정확히 일치하는지 확인

### 도움 받기

1. **Vercel 지원**: Vercel 문서 및 지원 확인
2. **Supabase 지원**: Supabase 커뮤니티 및 문서 사용
3. **프로젝트 이슈**: GitHub 이슈 확인 또는 새로 생성

## 보안 체크리스트

라이브 전에:
- [ ] 모든 API 키가 환경 변수로 저장됨
- [ ] 데이터베이스에 적절한 RLS 정책이 있음
- [ ] HTTPS가 활성화됨 (Vercel에서 자동)
- [ ] 클라이언트 측 코드에 민감한 데이터 없음
- [ ] 속도 제한이 구성됨
- [ ] 오류 메시지가 민감한 정보를 노출하지 않음

## 성능 최적화

### 권장 설정

1. **Vercel 구성**: `vercel.json`이 이미 최적화됨
2. **데이터베이스 인덱스**: 적절한 인덱스가 생성되었는지 확인
3. **캐싱**: API 응답이 적절히 캐시됨
4. **번들 크기**: 번들 크기 모니터링 및 최적화

### 모니터링

1. 성능 인사이트를 위해 Vercel Analytics 사용
2. Core Web Vitals 모니터링
3. API 응답 시간 추적
4. 데이터베이스 쿼리 성능 모니터링

---

## 빠른 참조

### 필수 URL
- **Vercel 대시보드**: https://vercel.com/dashboard
- **Supabase 대시보드**: https://supabase.com/dashboard
- **앱**: https://your-app-name.vercel.app

### 주요 명령어
```bash
# 프로덕션에 배포
vercel --prod

# 배포 상태 확인
vercel ls

# 로그 보기
vercel logs

# 환경 변수 추가
vercel env add VARIABLE_NAME production
```

### 지원 리소스
- [Vercel 문서](https://vercel.com/docs)
- [Supabase 문서](https://supabase.com/docs)
- [Next.js 문서](https://nextjs.org/docs)

---

**참고**: 배포 프로세스를 변경하거나 애플리케이션에 새로운 기능을 추가할 때마다 이 가이드를 업데이트하세요.
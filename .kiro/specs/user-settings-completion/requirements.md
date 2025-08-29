# Requirements Document

## Introduction

사용자별 개인 설정 기능을 완성하여 Google Drive API, Zotero API, AI 관련 API 키들을 안전하게 저장하고 관리할 수 있도록 합니다. 모든 API 키는 암호화되어 Supabase 데이터베이스에 저장되며, 사용자는 각 서비스별로 설정을 개별적으로 관리할 수 있습니다.

## Requirements

### Requirement 1: AI 모델 설정 관리

**User Story:** 사용자로서 AI 분석에 사용할 기본 모델을 선택하고 각 모델별 설정을 저장하고 싶습니다.

#### Acceptance Criteria

1. WHEN 사용자가 AI Configuration 탭에 접근하면 THEN 시스템은 사용 가능한 AI 모델 목록을 표시해야 합니다
2. WHEN 사용자가 기본 모델을 선택하면 THEN 시스템은 해당 설정을 데이터베이스에 저장해야 합니다
3. WHEN 사용자가 모델별 파라미터를 설정하면 THEN 시스템은 해당 설정을 사용자별로 저장해야 합니다
4. WHEN 사용자가 페이지를 새로고침하면 THEN 시스템은 이전에 저장된 설정을 불러와야 합니다

### Requirement 2: Zotero 설정 UI 완성

**User Story:** 사용자로서 Zotero API 키와 라이브러리 설정을 쉽게 입력하고 관리하고 싶습니다.

#### Acceptance Criteria

1. WHEN 사용자가 Reference Manager 탭에 접근하면 THEN 시스템은 Zotero 설정 폼을 표시해야 합니다
2. WHEN 사용자가 Zotero API 키를 입력하면 THEN 시스템은 키의 유효성을 검증해야 합니다
3. WHEN 사용자가 설정을 저장하면 THEN 시스템은 암호화된 형태로 데이터베이스에 저장해야 합니다
4. WHEN 사용자가 연결 테스트를 실행하면 THEN 시스템은 Zotero API와의 연결 상태를 확인해야 합니다
5. WHEN 사용자가 자동 동기화를 설정하면 THEN 시스템은 해당 설정을 저장하고 적용해야 합니다

### Requirement 3: 데이터베이스 타입 정의 완성

**User Story:** 개발자로서 모든 데이터베이스 테이블에 대한 TypeScript 타입 정의가 완성되어 타입 안전성을 보장받고 싶습니다.

#### Acceptance Criteria

1. WHEN 개발자가 데이터베이스 관련 코드를 작성하면 THEN 시스템은 모든 테이블에 대한 타입 정의를 제공해야 합니다
2. WHEN 컴파일 시점에 THEN 시스템은 타입 불일치 오류를 감지해야 합니다
3. WHEN 새로운 테이블이 추가되면 THEN 해당 타입 정의도 함께 추가되어야 합니다

### Requirement 4: 사용자 인증 연동 완성

**User Story:** 사용자로서 로그인한 상태에서만 개인 설정에 접근할 수 있고, 다른 사용자의 설정은 볼 수 없어야 합니다.

#### Acceptance Criteria

1. WHEN 사용자가 로그인하지 않은 상태에서 설정 페이지에 접근하면 THEN 시스템은 로그인 페이지로 리다이렉트해야 합니다
2. WHEN 사용자가 설정을 저장하면 THEN 시스템은 현재 로그인한 사용자의 ID와 연결하여 저장해야 합니다
3. WHEN 사용자가 설정을 조회하면 THEN 시스템은 해당 사용자의 설정만 반환해야 합니다
4. WHEN 데이터베이스 쿼리가 실행되면 THEN RLS(Row Level Security) 정책이 적용되어야 합니다

### Requirement 5: 설정 유효성 검증 및 오류 처리

**User Story:** 사용자로서 잘못된 API 키나 설정을 입력했을 때 명확한 오류 메시지를 받고 싶습니다.

#### Acceptance Criteria

1. WHEN 사용자가 잘못된 API 키를 입력하면 THEN 시스템은 구체적인 오류 메시지를 표시해야 합니다
2. WHEN API 키 검증이 실패하면 THEN 시스템은 실패 이유를 사용자에게 알려야 합니다
3. WHEN 네트워크 오류가 발생하면 THEN 시스템은 재시도 옵션을 제공해야 합니다
4. WHEN 설정 저장이 실패하면 THEN 시스템은 사용자에게 실패 원인을 알려야 합니다

### Requirement 6: 네비게이션 바 구현

**User Story:** 사용자로서 모든 페이지에서 일관된 네비게이션을 통해 다른 페이지로 쉽게 이동하고 싶습니다.

#### Acceptance Criteria

1. WHEN 사용자가 어떤 페이지에 있든 THEN 시스템은 상단에 네비게이션 바를 표시해야 합니다
2. WHEN 사용자가 네비게이션 메뉴를 클릭하면 THEN 시스템은 해당 페이지로 이동해야 합니다
3. WHEN 사용자가 로고나 홈 버튼을 클릭하면 THEN 시스템은 첫 화면(대시보드)으로 이동해야 합니다
4. WHEN 사용자가 현재 페이지에 있으면 THEN 네비게이션에서 해당 메뉴가 활성화 상태로 표시되어야 합니다
5. WHEN 사용자가 로그인하지 않은 상태면 THEN 네비게이션에 로그인 버튼이 표시되어야 합니다
6. WHEN 사용자가 로그인한 상태면 THEN 네비게이션에 사용자 메뉴와 로그아웃 버튼이 표시되어야 합니다

### Requirement 7: 설정 백업 및 복원

**User Story:** 사용자로서 설정을 내보내고 가져올 수 있어서 다른 환경에서도 동일한 설정을 사용하고 싶습니다.

#### Acceptance Criteria

1. WHEN 사용자가 설정 내보내기를 요청하면 THEN 시스템은 암호화된 설정 파일을 생성해야 합니다
2. WHEN 사용자가 설정 파일을 가져오면 THEN 시스템은 파일의 유효성을 검증해야 합니다
3. WHEN 설정을 가져올 때 THEN 시스템은 기존 설정을 덮어쓸지 사용자에게 확인해야 합니다
4. IF 설정 파일이 손상되었다면 THEN 시스템은 오류 메시지를 표시하고 가져오기를 중단해야 합니다
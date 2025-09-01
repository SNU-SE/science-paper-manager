#!/usr/bin/env node

const fs = require('fs');

// 수정이 필요한 파일들
const filesToFix = [
  'src/app/api/usage/route.ts',
  'src/app/api/usage/suspicious/route.ts', 
  'src/app/api/usage/limits/route.ts'
];

function fixAPIUsageServiceImport(content) {
  // import 변경
  content = content.replace(
    /import { apiUsageService } from '@\/services\/usage\/APIUsageService'/g,
    "import { createAPIUsageService } from '@/services/usage/APIUsageService'"
  );
  
  return content;
}

function fixAPIUsageServiceUsage(content) {
  // supabase 생성 후에 apiUsageService 인스턴스 생성하는 코드 추가
  // 패턴: supabase 체크 후 try 문 시작 부분에서
  content = content.replace(
    /(if \(!supabase\) \{[\s\S]*?\}\s*try \{)/g,
    '$1\n    const apiUsageService = createAPIUsageService(supabase)\n'
  );
  
  return content;
}

// 파일들을 수정
filesToFix.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`파일을 찾을 수 없습니다: ${filePath}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 이미 createAPIUsageService를 사용하고 있는지 확인
    if (content.includes('createAPIUsageService')) {
      console.log(`이미 수정됨: ${filePath}`);
      return;
    }
    
    console.log(`수정 중: ${filePath}`);
    
    // import 수정
    content = fixAPIUsageServiceImport(content);
    
    // 사용법 수정 
    content = fixAPIUsageServiceUsage(content);
    
    fs.writeFileSync(filePath, content);
    console.log(`수정 완료: ${filePath}`);
    
  } catch (error) {
    console.error(`오류 발생 ${filePath}:`, error.message);
  }
});

console.log('APIUsageService 수정 완료');
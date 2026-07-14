## Environment Variables

1. `.env.local` 파일은 GitHub에 커밋하지 않습니다.
2. 실제 API 키는 README, 코드, 스크린샷, 채팅 로그에 기록하지 않습니다.
3. 서버 비밀키에는 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다.
4. Gemini API, 결제 Secret, Firebase Admin 키는 서버 Route 또는 Secret Manager에서만 사용합니다.
5. 배포 환경에서는 Firebase App Hosting 또는 배포 플랫폼의 Secret 설정에 값을 등록합니다.
6. `.env.example`에는 변수 이름만 기록하고 실제 값은 넣지 않습니다.

Example:

GEMINI_API_KEY=
TOSS_SECRET_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=

## Security Policy

GodTheWord AI는

- API Key를 GitHub에 저장하지 않습니다.
- 모든 Secret Key는 서버 환경변수(Secret Manager)에서만 관리합니다.
- 클라이언트에는 공개 가능한 NEXT_PUBLIC_* 값만 전달합니다.
- 결제 Secret, Gemini API Key, Firebase Admin Key는 브라우저로 전송하지 않습니다.

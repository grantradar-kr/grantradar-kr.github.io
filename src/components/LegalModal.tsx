import Modal, { ModalHeader } from './Modal'

export type LegalKind = 'privacy' | 'terms'

interface Props {
  kind: LegalKind | null
  onClose: () => void
}

const UPDATED = '2026-11-18'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="text-[13.5px] font-extrabold text-ink-900">{title}</h3>
      <div className="mt-1 space-y-1.5 text-[12.5px] leading-[1.8] text-ink-600">{children}</div>
    </section>
  )
}

function PrivacyBody() {
  return (
    <>
      <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed text-ink-500">
        보조금 레이더(이하 “서비스”)는 회원가입 없이도 모든 핵심 기능을 쓸 수 있도록 만들었습니다. 로그인은 기기를 바꿔도 내
        조건과 저장 목록을 유지하기 위한 <b>선택 기능</b>입니다.
      </p>

      <Section title="1. 수집하는 개인정보">
        <ul className="list-disc space-y-1 pl-4">
          <li>회원가입 시: 이메일 주소, 비밀번호(단방향 암호화되어 저장되며 운영자도 볼 수 없습니다)</li>
          <li>서비스 이용 중 이용자가 직접 입력한 정보: 출생연도, 성별, 거주 지역, 직군, 가구·상황, 관심 분야, 소득 구분</li>
          <li>저장 목록, 체크리스트 진행 상태</li>
          <li>자동 수집: 접속 기기 정보, 브라우저 종류, 방문 페이지 등 통계용 비식별 정보</li>
        </ul>
        <p>주민등록번호, 계좌번호, 카드번호, 건강정보 등 민감정보는 수집하지 않습니다.</p>
      </Section>

      <Section title="2. 이용 목적">
        <ul className="list-disc space-y-1 pl-4">
          <li>이용자 조건에 맞는 보조금·지원 제도 매칭 및 표시</li>
          <li>기기 변경 시 조건·저장 목록 복원(로그인한 경우)</li>
          <li>서비스 품질 개선을 위한 통계 분석(비식별)</li>
        </ul>
      </Section>

      <Section title="3. 보관 및 파기">
        <p>
          회원 탈퇴를 요청하면 계정 정보와 저장 목록은 지체 없이 파기합니다. 로그인하지 않은 이용자의 데이터는 이용자 기기(브라우저
          저장소)에만 남아 있으며, 설정 → 내 데이터 삭제로 언제든 지울 수 있습니다.
        </p>
      </Section>

      <Section title="4. 처리 위탁 및 국외 이전">
        <p>
          로그인·데이터 저장에 Supabase Inc.의 클라우드 데이터베이스를 이용합니다(서버 지역: 대한민국 또는 인접 리전). 위탁 범위는
          계정 인증과 저장 데이터 보관으로 한정됩니다. 클라우드가 연결되지 않은 상태에서는 어떤 데이터도 서버로 전송되지 않습니다.
        </p>
      </Section>

      <Section title="5. 쿠키·광고">
        <p>
          서비스는 무료로 운영되며, 운영 비용을 위해 Google AdSense(웹)·AdMob(앱) 광고를 게재할 수 있습니다. Google은 쿠키를
          사용해 관심 기반 광고를 제공할 수 있으며, 이는 Google 광고 설정에서 거부할 수 있습니다. 광고 영역은 승인 전에는 표시되지
          않습니다.
        </p>
      </Section>

      <Section title="6. 이용자의 권리">
        <p>
          이용자는 언제든지 자신의 정보를 조회·수정·삭제할 수 있습니다. 앱 내 ‘설정 → 내 조건 수정’, ‘내 데이터 내보내기/삭제’
          기능을 이용하거나 아래 문의처로 요청해 주세요.
        </p>
      </Section>

      <Section title="7. 문의처">
        <p>
          이메일: <b>sasolution.edu@gmail.com</b>
          <br />
          시행일: {UPDATED}
        </p>
      </Section>
    </>
  )
}

function TermsBody() {
  return (
    <>
      <Section title="1. 서비스의 성격">
        <p>
          보조금 레이더는 정부·공공기관이 운영하는 공식 앱이 아닌 <b>민간 정보 매칭 플랫폼</b>입니다. 온통청년, 복지로, 기업마당,
          K-Startup, 공공데이터포털 등에 공개된 공고를 수집·정리해 이용자 조건과 비교해 보여줍니다.
        </p>
      </Section>

      <Section title="2. 정보의 정확성">
        <p>
          수집 시점과 공고 원문 사이에는 차이가 있을 수 있고, 자격 요건은 개별 사업의 세부 기준(소득·재산·가구원 수 등)에 따라
          달라집니다. 서비스가 표시하는 일치율과 판정은 <b>참고 지표</b>이며, 신청 자격을 보장하지 않습니다. 최종 자격 확인과 신청은
          반드시 공식 사이트의 공고문을 통해 진행해 주세요.
        </p>
      </Section>

      <Section title="3. 이용자의 책임">
        <ul className="list-disc space-y-1 pl-4">
          <li>서비스 정보를 근거로 한 신청·계약의 결과는 이용자 본인에게 귀속됩니다.</li>
          <li>서비스 화면을 무단으로 복제·크롤링·재판매하거나, 자동화된 대량 요청으로 운영을 방해하는 행위를 금지합니다.</li>
          <li>타인의 정보를 도용해 가입하거나 서비스 운영을 방해하는 행위를 금지합니다.</li>
        </ul>
      </Section>

      <Section title="4. 서비스의 변경·중단">
        <p>
          공고 원문 제공 기관의 정책 변경, 서버 점검, 천재지변 등으로 수집이 일시 중단되거나 데이터가 지연될 수 있습니다. 중요한
          변경은 앱 내 공지로 안내합니다.
        </p>
      </Section>

      <Section title="5. 책임의 한계">
        <p>
          서비스는 무료로 제공되며, 정보의 완전성·최신성을 보증하지 않습니다. 서비스 이용으로 발생한 지원금 미수령, 신청 지연 등에
          대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.
        </p>
      </Section>

      <Section title="6. 준거법">
        <p>본 약관은 대한민국 법률에 따르며, 분쟁은 서울 관할 법원을 제1심 관할로 합니다. 시행일: {UPDATED}</p>
      </Section>
    </>
  )
}

export default function LegalModal({ kind, onClose }: Props) {
  if (!kind) return null
  return (
    <Modal open onClose={onClose} size="md" label={kind === 'privacy' ? '개인정보처리방침' : '이용약관'}>
      <ModalHeader
        title={kind === 'privacy' ? '개인정보처리방침' : '이용약관'}
        subtitle={`시행일 ${UPDATED} · 보조금 레이더`}
        onClose={onClose}
      />
      <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{kind === 'privacy' ? <PrivacyBody /> : <TermsBody />}</div>
    </Modal>
  )
}

/**
 * parser.js
 * CSV 및 Excel(.xlsx, .xls) 파일 파싱, 컬럼 정규화, 결측치 보정 모듈
 */

const Parser = {
  /**
   * 문자열 숫자 정제 및 변환 (쉼표, 통화기호, 공백 제거)
   */
  cleanNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    
    // 문자열에서 쉼표, 원화기호, 공백, 하이픈 제거
    const cleaned = String(val).replace(/,/g, '').replace(/[₩\s\-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  },

  /**
   * 컬럼 헤더 정규화 매핑 테이블
   */
  normalizeKey(key) {
    if (!key) return '';
    const cleanKey = String(key).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    if (/연번|no|순번|번호/i.test(cleanKey)) return 'id';
    if (/대분류|전략분야/i.test(cleanKey)) return 'majorCategory';
    if (/중분류|전략과제/i.test(cleanKey)) return 'midCategory';
    if (/소분류|세부분야/i.test(cleanKey)) return 'subCategory';
    if (/지원기능|기능/i.test(cleanKey)) return 'functionType';
    if (/사업명|과제명|프로젝트명/i.test(cleanKey)) return 'projectName';
    if (/사업유형|유형/i.test(cleanKey)) return 'projectType';
    if (/위\/수탁|위수탁/i.test(cleanKey)) return 'isConsigned';
    if (/공모사업|공모/i.test(cleanKey)) return 'isOpenContest';
    if (/자체사업|자체/i.test(cleanKey)) return 'isSelfProject';
    if (/부산시\s*소관부서|소관부서|시\s*부서/i.test(cleanKey)) return 'cityDept';
    if (/진흥원\s*담당부서|담당부서|수행부서/i.test(cleanKey)) return 'agencyDept';
    if (/국비/i.test(cleanKey)) return 'budgetGov';
    if (/시비/i.test(cleanKey)) return 'budgetCity';
    if (/기타|민자/i.test(cleanKey)) return 'budgetPrivate';
    if (/총예산|합계|총액/i.test(cleanKey)) return 'budgetTotal';
    if (/재원\s*내역|재원\s*상세/i.test(cleanKey)) return 'fundingDetail';
    if (/주요\s*지원\s*내용|주요\s*내용|사업내용|개요/i.test(cleanKey)) return 'description';

    return cleanKey;
  },

  /**
   * 원시 객체 배열 정규화
   */
  normalizeRows(rawRows) {
    if (!Array.isArray(rawRows) || rawRows.length === 0) return [];

    return rawRows.map((row, idx) => {
      const normalized = {
        id: idx + 1,
        majorCategory: '기타',
        midCategory: '',
        subCategory: '기타',
        functionType: '기타',
        projectName: '무제 사업',
        projectType: '기타',
        cityDept: '미지정',
        agencyDept: '미지정',
        budgetGov: 0,
        budgetCity: 0,
        budgetPrivate: 0,
        budgetTotal: 0,
        fundingDetail: '',
        description: '',
        raw: row
      };

      for (const [key, value] of Object.entries(row)) {
        const stdKey = this.normalizeKey(key);
        if (!stdKey) continue;

        if (['budgetGov', 'budgetCity', 'budgetPrivate', 'budgetTotal'].includes(stdKey)) {
          normalized[stdKey] = this.cleanNumber(value);
        } else if (stdKey === 'id') {
          const parsedId = parseInt(value, 10);
          normalized.id = isNaN(parsedId) ? (idx + 1) : parsedId;
        } else {
          normalized[stdKey] = value !== null && value !== undefined ? String(value).trim() : '';
        }
      }

      // 총예산이 0이거나 미입력인 경우 국비+시비+기타/민자로 자동 계산
      const calcTotal = normalized.budgetGov + normalized.budgetCity + normalized.budgetPrivate;
      if (normalized.budgetTotal <= 0 && calcTotal > 0) {
        normalized.budgetTotal = calcTotal;
      }

      // 사업유형 보정 (컬럼에 위/수탁, 공모사업 체크가 있는 경우)
      if (!normalized.projectType || normalized.projectType === '기타') {
        const raw = normalized.raw;
        for (const [k, v] of Object.entries(raw)) {
          if (String(v).includes('○') || String(v).includes('O') || String(v).includes('o')) {
            if (k.includes('위/수탁')) normalized.projectType = '위/수탁';
            else if (k.includes('공모')) normalized.projectType = '공모사업';
            else if (k.includes('자체')) normalized.projectType = '자체사업';
          }
        }
      }

      return normalized;
    }).filter(row => row.projectName && row.projectName !== '무제 사업' && row.projectName !== '사업명');
  },

  /**
   * CSV 파일 또는 텍스트 파싱
   */
  parseCSV(fileOrText) {
    return new Promise((resolve, reject) => {
      if (typeof fileOrText === 'string') {
        Papa.parse(fileOrText, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            const data = this.normalizeRows(results.data);
            resolve(data);
          },
          error: (err) => reject(err)
        });
      } else if (fileOrText instanceof File || fileOrText instanceof Blob) {
        // 인코딩 처리: 기본 UTF-8 시도 후 한글 깨짐 감지 시 EUC-KR로 재시도
        const reader = new FileReader();
        reader.onload = (e) => {
          let text = e.target.result;
          // 한글 깨짐 감지 (EUC-KR fallback)
          if (text.includes('')) {
            const readerEucKr = new FileReader();
            readerEucKr.onload = (ev) => {
              this.parseCSV(ev.target.result).then(resolve).catch(reject);
            };
            readerEucKr.readAsText(fileOrText, 'EUC-KR');
            return;
          }

          this.parseCSV(text).then(resolve).catch(reject);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(fileOrText, 'UTF-8');
      } else {
        reject(new Error('지원하지 않는 파일 형식입니다.'));
      }
    });
  },

  /**
   * Excel(.xlsx, .xls) 파일 파싱
   */
  parseExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          
          const normalized = this.normalizeRows(jsonData);
          resolve(normalized);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * 파일 확장자에 따라 적절한 파서 자동 선택
   */
  parseFile(file) {
    if (!file) {
      return Promise.reject(new Error('선택된 파일이 없습니다.'));
    }
    const filename = file.name.toLowerCase();
    if (filename.endsWith('.csv')) {
      return this.parseCSV(file);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      return this.parseExcel(file);
    } else {
      return Promise.reject(new Error('지원하지 않는 파일 확장자입니다. (.csv, .xlsx, .xls 파일만 가능)'));
    }
  },

  /**
   * 기본 샘플 파일 로드 (sample_budget.csv)
   */
  async loadSampleBudget() {
    try {
      const response = await fetch('sample_budget.csv');
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const csvText = await response.text();
      return this.parseCSV(csvText);
    } catch (err) {
      console.warn('sample_budget.csv fetch 실패, 내장 기본 데이터로 대체합니다.', err);
      return this.getFallbackData();
    }
  },

  /**
   * 로컬 file:// 프로토콜 직접 실행 시 fetch 차단 대비 내장 데이터
   */
  getFallbackData() {
    const fallback = [
      { id: 1, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "양자정보", functionType: "산업기반 조성", projectName: "양자정보기술 생태계 산업 활성화", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 0, budgetCity: 600, budgetPrivate: 0, budgetTotal: 600, fundingDetail: "시비 600", description: "지역 양자산업 생태계 조성 및 저변 확대" },
      { id: 2, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "양자과학", functionType: "산업기반 조성", projectName: "양자과학기술센터 구축 및 운영", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 0, budgetCity: 800, budgetPrivate: 0, budgetTotal: 800, fundingDetail: "시비 800", description: "양자 공동 R&D 인프라 조성" },
      { id: 3, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "양자컴퓨팅·물류", functionType: "기술혁신", projectName: "양자컴퓨팅 기반 양자이득 도전연구", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 0, budgetCity: 100, budgetPrivate: 0, budgetTotal: 100, fundingDetail: "시비 100", description: "물류 최적화 양자 알고리즘 개발" },
      { id: 4, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "양자부품·장비", functionType: "기술혁신", projectName: "양자공통기반 기술개발(냉동기)", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 0, budgetCity: 50, budgetPrivate: 0, budgetTotal: 50, fundingDetail: "시비 50", description: "양자컴퓨터용 극저온 건조 희석식 냉동기 개발" },
      { id: 5, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "양자실증", functionType: "기술혁신", projectName: "수요기반 양자기술 실증 및 컨설팅", projectType: "공모사업", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 87.8, budgetCity: 180, budgetPrivate: 0, budgetTotal: 267.8, fundingDetail: "국비 87.8, 시비 180", description: "양자자기센서 기반 비접촉식 검수시스템 실증" },
      { id: 6, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "클라우드", functionType: "행사개최", projectName: "클라우드 엑스포 개최", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "디지털융합단", budgetGov: 90, budgetCity: 90, budgetPrivate: 0, budgetTotal: 180, fundingDetail: "국비 90, 시비 90", description: "클라우드 전문 전시회 및 신기술 컨퍼런스" },
      { id: 7, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "클라우드", functionType: "산업기반 조성", projectName: "글로벌 클라우드 산업육성", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 0, budgetCity: 800, budgetPrivate: 415, budgetTotal: 1215, fundingDetail: "시비 800, 민자 415", description: "클라우드 혁신센터 운영 및 SaaS 개발 지원" },
      { id: 8, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "클라우드", functionType: "인재양성", projectName: "클라우드컴퓨팅 전문인력 양성기관", projectType: "공모사업", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 240, budgetCity: 0, budgetPrivate: 0, budgetTotal: 240, fundingDetail: "국비 240", description: "부울경 광역거점 IT/SW 인재 교육" },
      { id: 9, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "데이터센터", functionType: "산업기반 조성", projectName: "지역 데이터센터 집적단지 활성화 지원 사업", projectType: "공모사업", cityDept: "인공지능소프트웨어과", agencyDept: "AI·AX단", budgetGov: 800, budgetCity: 800, budgetPrivate: 0, budgetTotal: 1600, fundingDetail: "국비 800, 시비 800", description: "에코델타시티 그린 데이터센터 집적단지 활성화" },
      { id: 10, majorCategory: "글로벌 선도", midCategory: "1-1. 전략기술 선도", subCategory: "XR·가상융합", functionType: "사업화 지원", projectName: "부산 가상증강현실 융복합센터 운영", projectType: "위/수탁", cityDept: "인공지능소프트웨어과", agencyDept: "디지털융합단", budgetGov: 0, budgetCity: 571, budgetPrivate: 0, budgetTotal: 571, fundingDetail: "시비 571", description: "가상융합기업 마케팅 및 제작 지원" }
    ];
    return Promise.resolve(fallback);
  }
};

window.Parser = Parser;

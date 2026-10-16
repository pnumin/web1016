/**
 * app.js
 * 메인 애플리케이션 진입점, 전역 상태 관리 및 이벤트 오케스트레이션
 */

const App = {
  state: {
    rawData: [],
    filteredData: [],
    currentTab: 'overview',
    filters: {
      search: '',
      majorCategory: 'all',
      agencyDept: 'all',
      cityDept: 'all',
      projectType: 'all',
      budgetMin: 0,
      budgetMax: Infinity
    },
    maxBudgetLimit: 5000,
    fileName: '샘플 예산자료 (2026년)'
  },

  /**
   * 앱 초기화
   */
  async init() {
    this.bindEvents();
    // 초기 로딩: 샘플 데이터 자동 로드
    await this.loadSample();
  },

  /**
   * 이벤트 리스너 등록
   */
  bindEvents() {
    // 1. 파일 입력(업로드) 이벤트
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }

    // 2. 드래그 앤 드롭 업로더
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropZone.classList.remove('drag-over');
        });
      });

      dropZone.addEventListener('drop', (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    // 3. 샘플 데이터 버튼
    const btnSample = document.getElementById('btnLoadSample');
    if (btnSample) {
      btnSample.addEventListener('click', () => this.loadSample());
    }

    // 4. 검색창 및 필터 변경 이벤트
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.state.filters.search = e.target.value;
          this.applyFilters();
        }, 250);
      });
    }

    ['selectCategory', 'selectAgencyDept', 'selectCityDept', 'selectProjectType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          const mapping = {
            selectCategory: 'majorCategory',
            selectAgencyDept: 'agencyDept',
            selectCityDept: 'cityDept',
            selectProjectType: 'projectType'
          };
          this.state.filters[mapping[id]] = e.target.value;
          this.applyFilters();
        });
      }
    });

    // 5. 예산 슬라이더
    const budgetRange = document.getElementById('filterBudgetMax');
    const budgetValueDisplay = document.getElementById('budgetMaxDisplay');
    if (budgetRange) {
      budgetRange.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.state.filters.budgetMax = val >= this.state.maxBudgetLimit ? Infinity : val;
        if (budgetValueDisplay) {
          budgetValueDisplay.textContent = val >= this.state.maxBudgetLimit ? '전체 (제한없음)' : `${Number(val).toLocaleString()} 백만원 이하`;
        }
        this.applyFilters();
      });
    }

    // 6. 필터 리셋 버튼
    const btnReset = document.getElementById('btnResetFilter');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetFilters());
    }

    // 7. 탭 전환 버튼
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // 8. 엑셀/CSV 다운로드 버튼
    const btnExportExcel = document.getElementById('btnExportExcel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', () => Table.exportToExcel(`예산자료_${this.formatToday()}.xlsx`));
    }
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => Table.exportToCSV(`예산자료_${this.formatToday()}.csv`));
    }

    // 9. 모달 외부 클릭 시 닫기
    const modal = document.getElementById('detailModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) Table.closeModal();
      });
    }
  },

  /**
   * 오늘 날짜 YYYYMMDD
   */
  formatToday() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  },

  /**
   * 파일 업로드 처리
   */
  async handleFileUpload(file) {
    this.showLoading(true);
    try {
      const data = await Parser.parseFile(file);
      if (!data || data.length === 0) {
        throw new Error('유효한 예산 데이터 레코드를 찾을 수 없습니다.');
      }
      this.state.fileName = file.name;
      this.onDataLoaded(data);
    } catch (err) {
      alert(`파일 파싱 오류: ${err.message || err}`);
      console.error(err);
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * 샘플 데이터 로드
   */
  async loadSample() {
    this.showLoading(true);
    try {
      const data = await Parser.loadSampleBudget();
      this.state.fileName = '기본 예산자료.csv (2026년도)';
      this.onDataLoaded(data);
    } catch (err) {
      console.error('샘플 데이터 로드 실패:', err);
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * 데이터 로드 완료 후 초기화
   */
  onDataLoaded(data) {
    this.state.rawData = data;
    const filterOptions = Filter.getFilterOptions(data);
    this.state.maxBudgetLimit = filterOptions.maxBudget;

    // 파일명 배지 갱신
    const badge = document.getElementById('loadedFileName');
    if (badge) {
      badge.textContent = `${this.state.fileName} (${data.length}개 과제 로드됨)`;
    }

    // 필터 드롭다운 채우기
    this.populateDropdown('selectCategory', filterOptions.majorCategories, '대분류 전체');
    this.populateDropdown('selectAgencyDept', filterOptions.agencyDepts, '진흥원 부서 전체');
    this.populateDropdown('selectCityDept', filterOptions.cityDepts, '시 소관부서 전체');
    this.populateDropdown('selectProjectType', filterOptions.projectTypes, '사업유형 전체');

    // 슬라이더 최대값 설정
    const slider = document.getElementById('filterBudgetMax');
    if (slider) {
      slider.max = filterOptions.maxBudget;
      slider.value = filterOptions.maxBudget;
      const budgetValueDisplay = document.getElementById('budgetMaxDisplay');
      if (budgetValueDisplay) budgetValueDisplay.textContent = '전체 (제한없음)';
    }

    this.resetFilters(false);
    this.applyFilters();
  },

  /**
   * 드롭다운 옵션 동적 생성
   */
  populateDropdown(id, items, defaultLabel) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<option value="all">${defaultLabel}</option>` +
      items.map(item => `<option value="${item}">${item}</option>`).join('');
  },

  /**
   * 필터 리셋
   */
  resetFilters(triggerApply = true) {
    this.state.filters = {
      search: '',
      majorCategory: 'all',
      agencyDept: 'all',
      cityDept: 'all',
      projectType: 'all',
      budgetMin: 0,
      budgetMax: Infinity
    };

    const s = document.getElementById('filterSearch');
    if (s) s.value = '';
    const cat = document.getElementById('selectCategory');
    if (cat) cat.value = 'all';
    const agency = document.getElementById('selectAgencyDept');
    if (agency) agency.value = 'all';
    const city = document.getElementById('selectCityDept');
    if (city) city.value = 'all';
    const type = document.getElementById('selectProjectType');
    if (type) type.value = 'all';

    const slider = document.getElementById('filterBudgetMax');
    if (slider) {
      slider.value = this.state.maxBudgetLimit;
      const disp = document.getElementById('budgetMaxDisplay');
      if (disp) disp.textContent = '전체 (제한없음)';
    }

    if (triggerApply) {
      this.applyFilters();
    }
  },

  /**
   * 필터 적용 및 뷰 갱신
   */
  applyFilters() {
    this.state.filteredData = Filter.filterData(this.state.rawData, this.state.filters);
    const kpi = Filter.calculateKPI(this.state.filteredData);

    // 1. KPI 카드 갱신
    this.renderKPI(kpi);

    // 2. 테이블 갱신
    Table.setData(this.state.filteredData);

    // 3. 활성 탭 차트 갱신
    this.renderCurrentTabCharts(kpi);
  },

  /**
   * KPI 카드 렌더링
   */
  renderKPI(kpi) {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setText('kpiTotalBudget', Number(kpi.totalBudget).toLocaleString('ko-KR', { maximumFractionDigits: 1 }));
    setText('kpiTotalBudgetEok', `(약 ${(parseFloat(kpi.totalBudget) / 100).toFixed(1)} 억원)`);
    setText('kpiTotalCount', `${kpi.totalCount.toLocaleString()} 개`);
    setText('kpiGovBudget', `${Number(kpi.totalGov).toLocaleString()} 백만원`);
    setText('kpiGovRatio', `${kpi.govRatio}%`);
    setText('kpiCityBudget', `${Number(kpi.totalCity).toLocaleString()} 백만원`);
    setText('kpiCityRatio', `${kpi.cityRatio}%`);
    setText('kpiPrivateBudget', `${Number(kpi.totalPrivate).toLocaleString()} 백만원`);
    setText('kpiPrivateRatio', `${kpi.privateRatio}%`);
    setText('kpiAvgBudget', `${Number(kpi.avgBudget).toLocaleString()} 백만원`);
  },

  /**
   * 탭 전환 처리
   */
  switchTab(tabName) {
    this.state.currentTab = tabName;

    // 탭 버튼 active 클래스 갱신
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 탭 패널 가시성 토글
    document.querySelectorAll('.tab-panel').forEach(panel => {
      if (panel.id === `tabPanel_${tabName}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // 해당 탭의 차트 렌더링
    const kpi = Filter.calculateKPI(this.state.filteredData);
    this.renderCurrentTabCharts(kpi);
  },

  /**
   * 차트 클릭 시 필터 자동 반영 콜백
   */
  handleChartFilter(filterKey, value) {
    const dropdownMap = {
      majorCategory: 'selectCategory',
      agencyDept: 'selectAgencyDept',
      cityDept: 'selectCityDept'
    };

    this.state.filters[filterKey] = value;
    const elemId = dropdownMap[filterKey];
    if (elemId) {
      const el = document.getElementById(elemId);
      if (el) el.value = value;
    }
    this.applyFilters();
  },

  /**
   * 현재 활성 탭의 차트들 렌더링
   */
  renderCurrentTabCharts(kpi) {
    const data = this.state.filteredData;
    const tab = this.state.currentTab;

    if (tab === 'overview') {
      Charts.renderMajorBudgetChart('chartMajorBudget', data, (key, val) => this.handleChartFilter(key, val));
      Charts.renderDeptBudgetChart('chartDeptBudget', data, (key, val) => this.handleChartFilter(key, val));
      Charts.renderBudgetRangeChart('chartBudgetRanges', data);
      Charts.renderTopProjectsChart('chartTopProjects', data, (item) => Table.openModal(item));
    } else if (tab === 'category') {
      Charts.renderMajorBudgetChart('chartCatMajor', data, (key, val) => this.handleChartFilter(key, val));
      Charts.renderFunctionBudgetChart('chartCatFunction', data);
    } else if (tab === 'department') {
      Charts.renderDeptBudgetChart('chartDeptAgency', data, (key, val) => this.handleChartFilter(key, val));
      Charts.renderCityDeptChart('chartDeptCity', data, (key, val) => this.handleChartFilter(key, val));
    } else if (tab === 'budget') {
      Charts.renderFundingSourceChart('chartBudgetFunding', kpi);
      Charts.renderTopProjectsChart('chartBudgetTop', data, (item) => Table.openModal(item));
      Charts.renderBudgetRangeChart('chartBudgetDist', data);
    }
  },

  /**
   * 로딩 인디케이터 표시/숨김
   */
  showLoading(show) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
      if (show) loader.classList.remove('hidden');
      else loader.classList.add('hidden');
    }
  }
};

// DOM 로드 완료 시 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;

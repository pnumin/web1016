/**
 * table.js
 * 데이터 테이블 그리드, 페이지네이션, 상세 모달 및 데이터 내보내기(Export) 모듈
 */

const Table = {
  state: {
    data: [],
    currentPage: 1,
    pageSize: 15,
    sortColumn: 'id',
    sortAsc: true
  },

  /**
   * 숫자 포맷팅
   */
  formatNum(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  },

  /**
   * 테이블 초기화 및 데이터 주입
   */
  setData(data, resetPage = true) {
    this.state.data = data || [];
    if (resetPage) this.state.currentPage = 1;
    this.render();
  },

  /**
   * 컬럼별 정렬 토글
   */
  toggleSort(colName) {
    if (this.state.sortColumn === colName) {
      this.state.sortAsc = !this.state.sortAsc;
    } else {
      this.state.sortColumn = colName;
      this.state.sortAsc = true;
    }
    this.render();
  },

  /**
   * 정렬된 데이터 산출
   */
  getSortedData() {
    const { sortColumn, sortAsc, data } = this.state;
    return [...data].sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  },

  /**
   * 페이지 이동
   */
  setPage(page) {
    const totalPages = Math.ceil(this.state.data.length / this.state.pageSize) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    this.state.currentPage = page;
    this.render();
  },

  /**
   * 페이지 크기 변경
   */
  setPageSize(size) {
    this.state.pageSize = parseInt(size, 10) || 15;
    this.state.currentPage = 1;
    this.render();
  },

  /**
   * 테이블 본문 및 페이지네이션 렌더링
   */
  render() {
    const tbody = document.getElementById('tableBody');
    const paginationContainer = document.getElementById('tablePagination');
    const totalCountBadge = document.getElementById('tableTotalCount');
    if (!tbody) return;

    const sorted = this.getSortedData();
    const total = sorted.length;
    if (totalCountBadge) {
      totalCountBadge.textContent = `${total.toLocaleString()} 건`;
    }

    const { currentPage, pageSize } = this.state;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (currentPage - 1) * pageSize;
    const pageRows = sorted.slice(startIndex, startIndex + pageSize);

    if (pageRows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-slate-400">
            <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
            조건에 부합하는 예산 사업 데이터가 없습니다.
          </td>
        </tr>
      `;
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    // 행 렌더링
    tbody.innerHTML = pageRows.map(row => {
      let typeBadgeClass = 'bg-slate-100 text-slate-700';
      if (row.projectType.includes('공모')) typeBadgeClass = 'bg-purple-100 text-purple-700';
      else if (row.projectType.includes('위/수탁')) typeBadgeClass = 'bg-blue-100 text-blue-700';
      else if (row.projectType.includes('자체')) typeBadgeClass = 'bg-emerald-100 text-emerald-700';

      return `
        <tr class="table-row-interactive border-b border-slate-100 text-sm hover:bg-blue-50/50" onclick="Table.openModalById(${row.id})">
          <td class="py-3 px-3 text-slate-500 font-medium text-center">${row.id}</td>
          <td class="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
            <span class="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800">${row.majorCategory}</span>
          </td>
          <td class="py-3 px-3 text-slate-900 font-semibold group-hover:text-blue-600">
            <div class="line-clamp-1">${row.projectName}</div>
            <div class="text-xs text-slate-400 font-normal line-clamp-1 mt-0.5">${row.subCategory || '-'}</div>
          </td>
          <td class="py-3 px-3 text-center whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass}">${row.projectType || '기타'}</span>
          </td>
          <td class="py-3 px-3 text-slate-600 whitespace-nowrap">${row.agencyDept}</td>
          <td class="py-3 px-3 text-right text-blue-600 font-mono font-medium">${this.formatNum(row.budgetGov)}</td>
          <td class="py-3 px-3 text-right text-emerald-600 font-mono font-medium">${this.formatNum(row.budgetCity)}</td>
          <td class="py-3 px-3 text-right text-slate-900 font-mono font-bold">${this.formatNum(row.budgetTotal)}</td>
          <td class="py-3 px-3 text-center whitespace-nowrap">
            <button type="button" class="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded transition font-medium"
              onclick="event.stopPropagation(); Table.openModalById(${row.id})">
              상세보기
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // 페이지네이션 렌더링
    if (paginationContainer) {
      let pagesHtml = `
        <div class="flex items-center justify-between w-full text-xs text-slate-500">
          <div>
            ${startIndex + 1} - ${Math.min(startIndex + pageSize, total)} / 총 ${total.toLocaleString()}건
          </div>
          <div class="flex items-center space-x-1">
            <button class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              ${currentPage === 1 ? 'disabled' : ''} onclick="Table.setPage(1)">
              <i class="fa-solid fa-angles-left"></i>
            </button>
            <button class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              ${currentPage === 1 ? 'disabled' : ''} onclick="Table.setPage(${currentPage - 1})">
              <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span class="px-3 py-1 font-semibold text-slate-700 bg-slate-100 rounded">${currentPage} / ${totalPages}</span>
            <button class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              ${currentPage === totalPages ? 'disabled' : ''} onclick="Table.setPage(${currentPage + 1})">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
            <button class="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
              ${currentPage === totalPages ? 'disabled' : ''} onclick="Table.setPage(${totalPages})">
              <i class="fa-solid fa-angles-right"></i>
            </button>
          </div>
        </div>
      `;
      paginationContainer.innerHTML = pagesHtml;
    }
  },

  /**
   * ID로 상세 모달 오픈
   */
  openModalById(id) {
    const item = this.state.data.find(d => d.id === id);
    if (item) {
      this.openModal(item);
    }
  },

  /**
   * 상세 모달 렌더링 및 노출
   */
  openModal(item) {
    const modal = document.getElementById('detailModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;

    const total = item.budgetTotal || 0;
    const govRatio = total > 0 ? Math.round(((item.budgetGov || 0) / total) * 100) : 0;
    const cityRatio = total > 0 ? Math.round(((item.budgetCity || 0) / total) * 100) : 0;
    const privRatio = total > 0 ? (100 - govRatio - cityRatio) : 0;

    content.innerHTML = `
      <div class="p-6">
        <!-- 헤더 -->
        <div class="flex items-start justify-between pb-4 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2 mb-1.5">
              <span class="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">${item.majorCategory}</span>
              <span class="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">${item.projectType || '일반'}</span>
              <span class="text-xs text-slate-400 font-mono">연번: ${item.id}</span>
            </div>
            <h3 class="text-xl font-bold text-slate-900 leading-snug">${item.projectName}</h3>
            ${item.midCategory ? `<p class="text-xs text-slate-500 mt-1">${item.midCategory}</p>` : ''}
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition" onclick="Table.closeModal()">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <!-- 예산 정보 카드 -->
        <div class="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div class="flex items-baseline justify-between mb-2">
            <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">2026년 총 예산 규모</span>
            <span class="text-2xl font-black text-slate-900 font-mono">${this.formatNum(item.budgetTotal)} <span class="text-sm font-semibold text-slate-500">백만원</span></span>
          </div>

          <!-- 재원 비율 프로그레스 바 -->
          <div class="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex mb-3">
            <div class="bg-blue-500 h-full" style="width: ${govRatio}%" title="국비 ${govRatio}%"></div>
            <div class="bg-emerald-500 h-full" style="width: ${cityRatio}%" title="시비 ${cityRatio}%"></div>
            <div class="bg-amber-500 h-full" style="width: ${privRatio}%" title="기타/민자 ${privRatio}%"></div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center text-xs">
            <div class="p-2 rounded bg-white border border-slate-200">
              <div class="text-slate-500">국비 (${govRatio}%)</div>
              <div class="font-bold text-blue-600 font-mono mt-0.5">${this.formatNum(item.budgetGov)} 백만원</div>
            </div>
            <div class="p-2 rounded bg-white border border-slate-200">
              <div class="text-slate-500">시비 (${cityRatio}%)</div>
              <div class="font-bold text-emerald-600 font-mono mt-0.5">${this.formatNum(item.budgetCity)} 백만원</div>
            </div>
            <div class="p-2 rounded bg-white border border-slate-200">
              <div class="text-slate-500">기타/민자 (${privRatio}%)</div>
              <div class="font-bold text-amber-600 font-mono mt-0.5">${this.formatNum(item.budgetPrivate)} 백만원</div>
            </div>
          </div>

          ${item.fundingDetail ? `
            <div class="mt-2.5 text-xs text-slate-600 bg-white/70 p-2 rounded border border-dashed border-slate-200">
              <span class="font-semibold text-slate-700">재원 상세:</span> ${item.fundingDetail}
            </div>
          ` : ''}
        </div>

        <!-- 부서 및 분류 메타정보 -->
        <div class="grid grid-cols-2 gap-3 mt-4 text-xs">
          <div class="p-3 rounded-lg bg-slate-50/60 border border-slate-200">
            <span class="text-slate-400 block mb-1">소관 부서</span>
            <span class="font-semibold text-slate-800 text-sm">${item.cityDept || '미지정'}</span>
          </div>
          <div class="p-3 rounded-lg bg-slate-50/60 border border-slate-200">
            <span class="text-slate-400 block mb-1">진흥원 담당 부서</span>
            <span class="font-semibold text-slate-800 text-sm">${item.agencyDept || '미지정'}</span>
          </div>
          <div class="p-3 rounded-lg bg-slate-50/60 border border-slate-200">
            <span class="text-slate-400 block mb-1">소분류 (기술분야)</span>
            <span class="font-semibold text-slate-800">${item.subCategory || '-'}</span>
          </div>
          <div class="p-3 rounded-lg bg-slate-50/60 border border-slate-200">
            <span class="text-slate-400 block mb-1">지원 기능</span>
            <span class="font-semibold text-slate-800">${item.functionType || '-'}</span>
          </div>
        </div>

        <!-- 주요 지원 내용 -->
        <div class="mt-4">
          <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">주요 지원 내용</h4>
          <div class="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            ${item.description || '상세 지원 내용이 등록되지 않았습니다.'}
          </div>
        </div>

        <!-- 모달 닫기 버튼 -->
        <div class="mt-6 flex justify-end">
          <button type="button" class="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg shadow-sm transition"
            onclick="Table.closeModal()">
            닫기
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  /**
   * 모달 닫기
   */
  closeModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  },

  /**
   * 엑셀(.xlsx) 파일로 내보내기
   */
  exportToExcel(filename = '예산자료_필터결과.xlsx') {
    if (!this.state.data || this.state.data.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const exportRows = this.state.data.map(item => ({
      '연번': item.id,
      '대분류': item.majorCategory,
      '중분류': item.midCategory,
      '소분류': item.subCategory,
      '지원기능': item.functionType,
      '사업명': item.projectName,
      '사업유형': item.projectType,
      '부산시 소관부서': item.cityDept,
      '진흥원 담당부서': item.agencyDept,
      '국비(백만원)': item.budgetGov,
      '시비(백만원)': item.budgetCity,
      '기타/민자(백만원)': item.budgetPrivate,
      '총예산(백만원)': item.budgetTotal,
      '재원 내역 상세': item.fundingDetail,
      '주요 지원 내용': item.description
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '예산자료');
    XLSX.writeFile(workbook, filename);
  },

  /**
   * CSV 파일로 내보내기
   */
  exportToCSV(filename = '예산자료_필터결과.csv') {
    if (!this.state.data || this.state.data.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const exportRows = this.state.data.map(item => ({
      '연번': item.id,
      '대분류': item.majorCategory,
      '중분류': item.midCategory,
      '소분류': item.subCategory,
      '지원기능': item.functionType,
      '사업명': item.projectName,
      '사업유형': item.projectType,
      '부산시 소관부서': item.cityDept,
      '진흥원 담당부서': item.agencyDept,
      '국비(백만원)': item.budgetGov,
      '시비(백만원)': item.budgetCity,
      '기타/민자(백만원)': item.budgetPrivate,
      '총예산(백만원)': item.budgetTotal,
      '재원 내역 상세': item.fundingDetail,
      '주요 지원 내용': item.description
    }));

    const csv = Papa.unparse(exportRows);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.Table = Table;

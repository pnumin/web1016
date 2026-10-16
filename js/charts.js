/**
 * charts.js
 * Chart.js 기반 인터랙티브 시각화 모듈
 */

const Charts = {
  instances: {},

  // 색상 팔레트
  colors: {
    primary: ['#3b82f6', '#1d4ed8', '#60a5fa', '#93c5fd', '#2563eb'],
    palette: [
      '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
      '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6'
    ],
    gov: '#3b82f6',    // 국비 (블루)
    city: '#10b981',   // 시비 (그린)
    private: '#f59e0b' // 민자 (앰버)
  },

  /**
   * 숫자 포맷팅 유틸 (천단위 쉼표)
   */
  formatNumber(val) {
    if (val === null || val === undefined) return '0';
    return Number(val).toLocaleString('ko-KR', { maximumFractionDigits: 1 });
  },

  /**
   * 차트 인스턴스 안전 파괴
   */
  destroyChart(key) {
    if (this.instances[key]) {
      this.instances[key].destroy();
      delete this.instances[key];
    }
  },

  /**
   * 전체 차트 인스턴스 파괴
   */
  destroyAll() {
    Object.keys(this.instances).forEach(key => this.destroyChart(key));
  },

  /**
   * 1. [종합] 대분류별 예산 점유율 (도넛 차트)
   */
  renderMajorBudgetChart(canvasId, data, onSelect) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // 대분류별 예산 집계
    const agg = {};
    data.forEach(item => {
      const cat = item.majorCategory || '기타';
      agg[cat] = (agg[cat] || 0) + (item.budgetTotal || 0);
    });

    const labels = Object.keys(agg);
    const values = Object.values(agg).map(v => Math.round(v * 10) / 10);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: this.colors.palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Pretendard', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${this.formatNumber(ctx.raw)} 백만원`
            }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onSelect) {
            const index = activeElements[0].index;
            onSelect('majorCategory', labels[index]);
          }
        }
      }
    });
  },

  /**
   * 2. [종합] 담당부서별 예산 스택 막대 (Stacked Bar Chart: 국비, 시비, 민자)
   */
  renderDeptBudgetChart(canvasId, data, onSelect) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const deptMap = {};
    data.forEach(item => {
      const dept = item.agencyDept || '미지정';
      if (!deptMap[dept]) {
        deptMap[dept] = { gov: 0, city: 0, private: 0, total: 0 };
      }
      deptMap[dept].gov += (item.budgetGov || 0);
      deptMap[dept].city += (item.budgetCity || 0);
      deptMap[dept].private += (item.budgetPrivate || 0);
      deptMap[dept].total += (item.budgetTotal || 0);
    });

    // 총 예산 내림차순 정렬
    const sortedDepts = Object.keys(deptMap).sort((a, b) => deptMap[b].total - deptMap[a].total);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedDepts,
        datasets: [
          { label: '국비', data: sortedDepts.map(d => deptMap[d].gov), backgroundColor: this.colors.gov },
          { label: '시비', data: sortedDepts.map(d => deptMap[d].city), backgroundColor: this.colors.city },
          { label: '기타/민자', data: sortedDepts.map(d => deptMap[d].private), backgroundColor: this.colors.private }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, ticks: { callback: (v) => this.formatNumber(v) } }
        },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${this.formatNumber(ctx.raw)} 백만원`
            }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onSelect) {
            const index = activeElements[0].index;
            onSelect('agencyDept', sortedDepts[index]);
          }
        }
      }
    });
  },

  /**
   * 3. [종합] 예산 규모 구간 분포 (히스토그램 형태)
   */
  renderBudgetRangeChart(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const ranges = {
      '10억 이상': 0,
      '5억 ~ 10억': 0,
      '3억 ~ 5억': 0,
      '1억 ~ 3억': 0,
      '1억 미만': 0
    };

    data.forEach(item => {
      const b = item.budgetTotal || 0;
      if (b >= 1000) ranges['10억 이상']++;
      else if (b >= 500) ranges['5억 ~ 10억']++;
      else if (b >= 300) ranges['3억 ~ 5억']++;
      else if (b >= 100) ranges['1억 ~ 3억']++;
      else ranges['1억 미만']++;
    });

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(ranges),
        datasets: [{
          label: '사업 수 (개)',
          data: Object.values(ranges),
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` 사업 수: ${ctx.raw}개`
            }
          }
        }
      }
    });
  },

  /**
   * 4. [종합] 최대 예산 사업 Top 10 (수평 막대 차트)
   */
  renderTopProjectsChart(canvasId, data, onProjectClick) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const sorted = [...data].sort((a, b) => (b.budgetTotal || 0) - (a.budgetTotal || 0)).slice(0, 10);
    const labels = sorted.map(item => item.projectName.length > 18 ? item.projectName.substring(0, 18) + '...' : item.projectName);
    const values = sorted.map(item => item.budgetTotal);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '총 예산 (백만원)',
          data: values,
          backgroundColor: '#0ea5e9',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { callback: (v) => this.formatNumber(v) } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => sorted[items[0].dataIndex].projectName,
              label: (ctx) => ` 총예산: ${this.formatNumber(ctx.raw)} 백만원 (${sorted[ctx.dataIndex].agencyDept})`
            }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onProjectClick) {
            const index = activeElements[0].index;
            onProjectClick(sorted[index]);
          }
        }
      }
    });
  },

  /**
   * 5. [분류별] 지원기능별 예산 분포
   */
  renderFunctionBudgetChart(canvasId, data) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const funcMap = {};
    data.forEach(item => {
      // 쉼표로 다중 지원기능 구분 처리
      const funcs = (item.functionType || '기타').split(/[,/]/).map(s => s.trim()).filter(Boolean);
      const splitBudget = funcs.length > 0 ? (item.budgetTotal || 0) / funcs.length : (item.budgetTotal || 0);

      funcs.forEach(f => {
        funcMap[f] = (funcMap[f] || 0) + splitBudget;
      });
    });

    const sorted = Object.entries(funcMap).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const values = sorted.map(x => Math.round(x[1] * 10) / 10);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '예산 규모 (백만원)',
          data: values,
          backgroundColor: this.colors.palette,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${this.formatNumber(ctx.raw)} 백만원`
            }
          }
        }
      }
    });
  },

  /**
   * 6. [부서별] 부산시 소관부서별 예산 현황
   */
  renderCityDeptChart(canvasId, data, onSelect) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const map = {};
    data.forEach(item => {
      const dept = item.cityDept || '미지정';
      map[dept] = (map[dept] || 0) + (item.budgetTotal || 0);
    });

    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(x => x[0]);
    const values = sorted.map(x => Math.round(x[1] * 10) / 10);

    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: '총 예산 (백만원)',
          data: values,
          backgroundColor: '#3b82f6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { ticks: { callback: (v) => this.formatNumber(v) } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${this.formatNumber(ctx.raw)} 백만원`
            }
          }
        },
        onClick: (evt, activeElements) => {
          if (activeElements.length > 0 && onSelect) {
            const index = activeElements[0].index;
            onSelect('cityDept', labels[index]);
          }
        }
      }
    });
  },

  /**
   * 7. [예산별] 재원 구조 파이 차트 (국비 vs 시비 vs 민자)
   */
  renderFundingSourceChart(canvasId, kpiData) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const values = [
      parseFloat(kpiData.totalGov),
      parseFloat(kpiData.totalCity),
      parseFloat(kpiData.totalPrivate)
    ];

    this.instances[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: [
          `국비 (${kpiData.govRatio}%)`,
          `시비 (${kpiData.cityRatio}%)`,
          `기타/민자 (${kpiData.privateRatio}%)`
        ],
        datasets: [{
          data: values,
          backgroundColor: [this.colors.gov, this.colors.city, this.colors.private],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 14 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${this.formatNumber(ctx.raw)} 백만원`
            }
          }
        }
      }
    });
  }
};

window.Charts = Charts;

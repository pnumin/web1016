/**
 * filter.js
 * 데이터 필터링, 검색, 통계 및 KPI 계산 모듈
 */

const Filter = {
  /**
   * 원시 데이터에서 고유한 필터 옵션 목록 추출
   */
  getFilterOptions(data) {
    const majorCategories = new Set();
    const agencyDepts = new Set();
    const cityDepts = new Set();
    const projectTypes = new Set();
    let maxBudget = 0;

    data.forEach(item => {
      if (item.majorCategory) majorCategories.add(item.majorCategory);
      if (item.agencyDept) agencyDepts.add(item.agencyDept);
      if (item.cityDept) cityDepts.add(item.cityDept);
      if (item.projectType) projectTypes.add(item.projectType);
      if (item.budgetTotal > maxBudget) maxBudget = item.budgetTotal;
    });

    return {
      majorCategories: Array.from(majorCategories).sort(),
      agencyDepts: Array.from(agencyDepts).sort(),
      cityDepts: Array.from(cityDepts).sort(),
      projectTypes: Array.from(projectTypes).sort(),
      maxBudget: Math.ceil(maxBudget || 1000)
    };
  },

  /**
   * 필터 조건에 따른 데이터 필터링
   */
  filterData(data, criteria) {
    if (!Array.isArray(data)) return [];

    const searchKeyword = (criteria.search || '').trim().toLowerCase();
    const {
      majorCategory = 'all',
      agencyDept = 'all',
      cityDept = 'all',
      projectType = 'all',
      budgetMin = 0,
      budgetMax = Infinity
    } = criteria;

    return data.filter(item => {
      // 1. 검색어 검사 (사업명, 주요 내용, 소분류, 담당부서, 재원내역)
      if (searchKeyword) {
        const targetString = `${item.projectName} ${item.description} ${item.subCategory} ${item.midCategory} ${item.agencyDept} ${item.cityDept} ${item.fundingDetail}`.toLowerCase();
        if (!targetString.includes(searchKeyword)) {
          return false;
        }
      }

      // 2. 대분류 검사
      if (majorCategory !== 'all' && item.majorCategory !== majorCategory) {
        return false;
      }

      // 3. 진흥원 담당부서 검사
      if (agencyDept !== 'all' && item.agencyDept !== agencyDept) {
        return false;
      }

      // 4. 부산시 소관부서 검사
      if (cityDept !== 'all' && item.cityDept !== cityDept) {
        return false;
      }

      // 5. 사업유형 검사
      if (projectType !== 'all' && item.projectType !== projectType) {
        return false;
      }

      // 6. 예산 범위 검사
      const total = item.budgetTotal || 0;
      if (total < budgetMin || total > budgetMax) {
        return false;
      }

      return true;
    });
  },

  /**
   * 데이터셋에 대한 핵심 KPI 통계 지표 계산
   */
  calculateKPI(data) {
    const totalCount = data.length;
    let totalBudget = 0;
    let totalGov = 0;
    let totalCity = 0;
    let totalPrivate = 0;
    let maxProject = null;

    data.forEach(item => {
      const budget = item.budgetTotal || 0;
      totalBudget += budget;
      totalGov += (item.budgetGov || 0);
      totalCity += (item.budgetCity || 0);
      totalPrivate += (item.budgetPrivate || 0);

      if (!maxProject || budget > maxProject.budgetTotal) {
        maxProject = item;
      }
    });

    const avgBudget = totalCount > 0 ? (totalBudget / totalCount) : 0;
    const govRatio = totalBudget > 0 ? ((totalGov / totalBudget) * 100).toFixed(1) : '0.0';
    const cityRatio = totalBudget > 0 ? ((totalCity / totalBudget) * 100).toFixed(1) : '0.0';
    const privateRatio = totalBudget > 0 ? ((totalPrivate / totalBudget) * 100).toFixed(1) : '0.0';

    return {
      totalCount,
      totalBudget: totalBudget.toFixed(1),
      totalGov: totalGov.toFixed(1),
      totalCity: totalCity.toFixed(1),
      totalPrivate: totalPrivate.toFixed(1),
      govRatio,
      cityRatio,
      privateRatio,
      avgBudget: avgBudget.toFixed(1),
      maxProject: maxProject || { projectName: '-', budgetTotal: 0 }
    };
  }
};

window.Filter = Filter;

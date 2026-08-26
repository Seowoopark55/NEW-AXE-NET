export const MODBOOK_PRESETS = [
  {
    id: 'movement-tier1',
    title: '이동속도 1티어',
    badge: 'AXE 추천 · 초안',
    description: '최대 옵션 기준으로 이동속도를 우선하고, 실사용 효율이 좋은 보조 옵션을 함께 챙긴 추천 세팅입니다.',
    criteria: '최대 옵션 기준 · 가격/성공률은 별도 고려',
    notes: [
      '하의는 바람의(+8%) 대신 쾌속의(+7% + 최대 스태미나 300)를 채택한 밸런스 조합입니다.',
      '신발의 레이서의는 이동속도 최고치가 높지만 전력질주 스킬 경험치 패널티가 있습니다.',
      '실사용 의견에 따라 AXE 추천 조합은 언제든 교체할 수 있습니다.',
    ],
    slots: {
      outer: {
        label: '겉옷',
        image: '/assets/modbook-presets/outer.svg',
        mods: [
          { type: '접두', name: '기운찬' },
          { type: '접미', name: '바람의' },
        ],
      },
      top: {
        label: '상의',
        image: '/assets/modbook-presets/top.svg',
        mods: [
          { type: '접미', name: '전력질주의' },
        ],
        emptyHint: '이동속도용 접두 추천은 비워둔 구성',
      },
      bottom: {
        label: '하의',
        image: '/assets/modbook-presets/bottom.svg',
        mods: [
          { type: '접두', name: '잡기 힘든' },
          { type: '접미', name: '쾌속의' },
        ],
      },
      shoes: {
        label: '신발',
        image: '/assets/modbook-presets/shoes.svg',
        mods: [
          { type: '접두', name: '기운찬' },
          { type: '접미', name: '레이서의' },
        ],
      },
    },
  },
];

export const MODBOOK_PRESET_SLOT_ORDER = ['outer', 'top', 'bottom', 'shoes'];

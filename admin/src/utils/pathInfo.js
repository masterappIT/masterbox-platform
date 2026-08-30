

export const pathInfo=[
    {
      icon: 'home',
      title: 'home',
      path: '/home',
    },
    {
      icon: 'messenger',
      title: 'messenger',
      // title: '即時訊息',
      path: '/',
    },
    {
      icon: 'messenger',
      title: 'chat_management',
      path: '/chat-management',
    },
    {
      icon: 'push',
      title: 'group_notifications',
      // title: '群發工具',
      path: '/group-notifications',
    },
    {
      icon: 'robot',
      title: 'bot_messaging',
      // title: '對話機器人',
      path: '/bot-messaging',
    },
    {
      icon: 'template',
      title: 'messaging_template',
      // title: '訊息範本',
      path: '/messaging-template',
    },
    {
      icon: 'client',
      title: 'customers_management',
      // title: '客戶管理',
      path: '/customers-management',
    },
    {
      icon: 'data',
      title: 'data_analysis',
      // title: '數據分析',
      path: '/data-analysis',
    },

    {
      icon: 'user',
      title: 'user_management',
      // title: '使用者管理',
      path: '/user-management',
    },
    {
      icon: 'account',
      title: 'channels_management',
      // title: '社群平台管理',
      path: '/channels-management',
    },
    {
      icon: 'company',
      title: 'company_information',
      // title: '公司資料管理',
      path: '/company-information',
    },
    {
      icon: 'setting',
      title: 'setting',
      // title: '設定',
      path: '/setting',
    },
    // {
    //   icon: 'language',
    //   title: '繁體中文',
    // },
    // {
    //   icon: 'signout',
    //   title: '登出',
    // },
  ]

  export const findHeaderBarTitle = (pathName) =>{

    const info = pathInfo.find(path => path.path.includes(pathName))
    // const info = pathInfo.find(path => path.path === pathName)

    return info?.title


  }
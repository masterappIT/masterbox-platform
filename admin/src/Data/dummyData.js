import Checkbox from "../stories/components/Checkbox";
import React from 'react';
import Toggle from "../stories/components/Toggle";




// export const dummyTableData = {
//     header: [
//         { key: 'status', value: '狀態', },
//         { key: 'name', value: '名稱' },
//         { key: 'id', value: 'ID' },
//         { key: 'role', value: 'role' },
//         { key: 'email', value: '電子信箱' },
//         { key: 'last_online_time', value: '最後上線時間' },
//         { key: 'is_online', value: '上線狀態' },
//         { key: 'edit', value: '編輯' }],
//     // row: [{ 'status': <div>status</div>, name: 'name', id: '1234565', 'role': 'admin', 'email': 'email', 'last_online_time': '2022/08/16 14:36', 'is_online': <div>is_online</div>, 'edit': <div>edit</div> }]
//     row: [{ 'status': <Toggle />, name: 'name', id: '1234565', 'role': 'admin', 'email': 'email', 'last_online_time': '2022/08/16 14:36', 'is_online': <div>is_online</div>, 'edit': <div>edit</div> }]
// }



export const dummyTableData = {
    'userMgmt': [
        {
            status: '0',
            name: 'name',
            id: '1234565',
            role: 'admin',
            email: 'testetst@gmail.com',
            last_online_time: '2022/08/16 14:36',
            is_online: true,
            edit: 'edit'
        },
        {
            status: '1',
            name: 'name',
            id: '1234565',
            role: 'admin',
            email: 'teste123tst@gmail.com',
            last_online_time: '2022/08/16 14:36',
            is_online: false,
            edit: 'edit'
        }
    ],
    'channelsMgmt': [
        {
            status: '0',
            name: 'name',
            channel: 'account',
            img: '123',
            edit: 'edit'
        },
        {
            status: '0',
            name: 'name',
            channel: 'account',
            img: '345',
            edit: 'edit'
        },

    ]
}




export const dummyChannelsManagementData = {
    header: [
        { key: 'status', value: '狀態', },
        { key: 'name', value: '社群名稱' },
        { key: 'channel', value: '連結社群' },
        { key: 'user', value: '擁有人' },
        { key: 'edit', value: '編輯' }],
    // row: [{ 'status': <div>status</div>, name: 'name', id: '1234565', 'role': 'admin', 'email': 'email', 'last_online_time': '2022/08/16 14:36', 'is_online': <div>is_online</div>, 'edit': <div>edit</div> }]
    row: [{ 'status': <Toggle />, name: 'name', channel: '連結社群', 'user': '擁有人', 'edit': <div>edit</div> }]
}
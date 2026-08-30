import React from 'react'
import PropTypes from 'prop-types'
import Avatar from './Avatar';
import { dummyTableData } from '../../Data/dummyData';
import Checkbox from './Checkbox';
import ContentText from './ContentText';
import Toggle from './Toggle';
import Icon from './Icon';
import Label from './Label';
import ListItem from './ListItem';
import Headline from './Headline';
import Search from './Search';
import Button from './Button';

function Table({ header, row, withCheckbox, withEdit, topElms, withPagination, colsTemplate, isSearch, selectedKeys, onSelectionChange }) {
    const getRowKey = (data, index) => data.find(cell => cell.key === 'id')?.value || index;
    const toggleSelection = (key) => {
        if (!onSelectionChange) return;
        const next = new Set(selectedKeys);
        next.has(key) ? next.delete(key) : next.add(key);
        onSelectionChange([...next]);
    };

    return (


        <div className={`table  `}>

            <div className='table-top'>
                {topElms}
            </div>


            <div className="table-body">

                <div className={`table-row table-header ${colsTemplate}`} style={{ gridTemplateColumns: colsTemplate }}>
                    {
                        withCheckbox && <div className={`table-cell `}>
                            <Checkbox onClick={() => onSelectionChange?.(selectedKeys.length === row.length ? [] : row.map((data, index) => getRowKey(data, index)))} checked={row.length > 0 && selectedKeys.length === row.length} />
                        </div>

                    }
                    {header?.map((value, i) =>
                        <div className={`table-cell `} key={value}>
                            <Headline title={value} size='small' />
                        </div>)}
                    {withEdit && <div className={`table-cell `}>
                        <Headline title='edit' size='small' />
                    </div>}

                </div>
                {(row&&row.length)? row.map((data, i) => {
                    const rowKey = getRowKey(data, i);
                    return <div key={rowKey} className={`table-row ${colsTemplate}`} style={{ gridTemplateColumns: colsTemplate }}>


                        {withCheckbox && <div className={`table-cell `}>
                            <Checkbox onClick={() => toggleSelection(rowKey)} checked={selectedKeys.includes(rowKey)} />
                        </div>}

                        {data.map(({ key, value, element }, i) =>
                                <div key={key + i} className={`table-cell `}>
                                    {
                                        element === 'text' ? <ContentText title={value} />
                                            : element === 'toggle' ? <Toggle status={parseInt(value)} />
                                                : element === 'icon' ? <Icon name={value} />
                                                    : element === 'label' ? <Label title={value ? '上線中' : '已離線'} color={value ? 'secondary' : 'quaternary'} />
                                                        : element === 'avatar' ? <Avatar name={value} size='small' />
                                                            : element === 'multipleAvatar' ? <Avatar name={value} size='mini' />
                                                                : element === 'iconText' ? <ContentText title={value} />
                                                                    // : element === 'iconText' ? <ListItem startElement={<Icon name={value} />} customStyles={{ padding: '0' }}><ContentText title={value} /></ListItem>
                                                                    : ''}
                                </div>
                            )}

                        {withEdit && <div className={`table-cell `}>
                            <Icon name='edit' />
                        </div>}

                    </div>;
                }):(
                    <div className='table-body-noData'>
                        <Headline  title='無任何一筆資料，趕快新增一筆資料吧'/>
                    </div>
                )}
            </div>

            {withPagination && <div className="table-pagination"></div>}
        </div>
    )
}

Table.propTypes = {
    header: PropTypes.array,
    row: PropTypes.array,
    withCheckbox: PropTypes.bool,
    withEdit: PropTypes.bool,
    topElms: PropTypes.element,
    selectedKeys: PropTypes.array,
    onSelectionChange: PropTypes.func,
}

Table.defaultProps = {
    header: dummyTableData.header,
    row: dummyTableData.row,
    topElms: null,
    withCheckbox: false,
    withEdit: false,
    selectedKeys: [],
    onSelectionChange: null,
}

export default Table

import React from 'react'
import PropTypes from 'prop-types'
import Avatar from './Avatar';
import Checkbox from './Checkbox';
import Toggle from './Toggle';
import Icon from './Icon';
import Label from './Label';
import Headline from './Headline';
import EmptyState from './EmptyState';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

const renderCell = ({ value, element, label, disabled }, rowIndex, onToggle, pendingToggles) => {
    switch (element) {
        case 'text':
        case 'iconText':
            return <span className='table-cell-text' title={typeof value === 'string' ? value : undefined}>{value}</span>;
        case 'toggle':
            return <Toggle status={parseInt(value)} label={label} onClick={onToggle ? (next) => onToggle(rowIndex, next) : null} disabled={disabled || pendingToggles.includes(rowIndex)} />;
        case 'icon':
            return <Icon name={value} />;
        case 'label':
            return <Label title={value ? '上線中' : '已離線'} color={value ? 'secondary' : 'quaternary'} />;
        case 'avatar':
            return <Avatar name={value} size='small' />;
        case 'multipleAvatar':
            return <Avatar name={value} size='mini' />;
        // The page has already built what goes in this cell.
        case 'custom':
            return value;
        default:
            return '';
    }
};

function Table({ header, row, withCheckbox, withEdit, topElms, footer, colsTemplate, loading, emptyText, emptyContent, selectedKeys, onSelectionChange, onToggle, pendingToggles, rowIds, onEdit }) {
    const getRowKey = (data, index) => rowIds?.[index] || data.find(cell => cell.key === 'id')?.value || index;
    const visibleKeys = row.map((data, index) => getRowKey(data, index));
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every(key => selectedKeys.includes(key));

    const toggleSelection = (key) => {
        if (!onSelectionChange) return;
        const next = new Set(selectedKeys);
        next.has(key) ? next.delete(key) : next.add(key);
        onSelectionChange([...next]);
    };
    // Selects this page's rows; rows picked on other pages stay picked.
    const toggleAllVisible = () => {
        if (!onSelectionChange) return;
        const next = new Set(selectedKeys);
        visibleKeys.forEach(key => allVisibleSelected ? next.delete(key) : next.add(key));
        onSelectionChange([...next]);
    };

    return (
        <div className='table'>
            {topElms && <div className='table-top'>{topElms}</div>}

            <div className='table-body'>
                <div className='table-row table-header' style={{ gridTemplateColumns: colsTemplate }}>
                    {withCheckbox && <div className='table-cell'>
                        <Checkbox size='large' ariaLabel='選取本頁全部' onClick={toggleAllVisible} checked={allVisibleSelected} />
                    </div>}
                    {header?.map((value, i) => <div className='table-cell' key={`${value}-${i}`}>
                        <Headline title={value} size='small' />
                    </div>)}
                    {withEdit && <div className='table-cell table-cell-center'>
                        <Headline title='編輯' size='small' />
                    </div>}
                </div>

                {loading
                    ? <div className='table-skeleton' role='status' aria-label='載入中'>
                        {SKELETON_ROWS.map((key) => <div key={key} className='table-skeleton-row'><span /><span /><span /><span /></div>)}
                    </div>
                    : row.length
                        ? row.map((data, rowIndex) => {
                            const rowKey = getRowKey(data, rowIndex);
                            const selected = selectedKeys.includes(rowKey);
                            return <div key={rowKey} className={`table-row ${selected ? 'table-row-selected' : ''}`} style={{ gridTemplateColumns: colsTemplate }}>
                                {withCheckbox && <div className='table-cell'>
                                    <Checkbox size='large' ariaLabel='選取此列' onClick={() => toggleSelection(rowKey)} checked={selected} />
                                </div>}
                                {data.map((cell, i) => <div key={cell.key + i} className='table-cell'>
                                    {renderCell(cell, rowIndex, onToggle, pendingToggles)}
                                </div>)}
                                {withEdit && <div className='table-cell table-cell-center'>
                                    <button type='button' className='table-edit' aria-label='編輯' onClick={() => onEdit?.(rowKey, rowIndex)}>
                                        <img src='/design/ui/edit.svg' alt='' width={16} height={16} />
                                    </button>
                                </div>}
                            </div>;
                        })
                        : <div className='table-body-noData'>
                            {emptyContent || <EmptyState title={emptyText} />}
                        </div>}
            </div>

            {footer && !loading && <div className='table-footer'>{footer}</div>}
        </div>
    )
}

Table.propTypes = {
    header: PropTypes.array,
    row: PropTypes.array,
    colsTemplate: PropTypes.string,
    withCheckbox: PropTypes.bool,
    withEdit: PropTypes.bool,
    topElms: PropTypes.element,
    footer: PropTypes.node,
    loading: PropTypes.bool,
    emptyText: PropTypes.string,
    emptyContent: PropTypes.node,
    selectedKeys: PropTypes.array,
    onSelectionChange: PropTypes.func,
    // Called with the row's index and the new value; without it a toggle only changes on screen.
    onToggle: PropTypes.func,
    // Row indexes whose toggle is being saved.
    pendingToggles: PropTypes.array,
    // Keys for selection when the rows have no visible id column.
    rowIds: PropTypes.array,
    // Called with the row's key and index.
    onEdit: PropTypes.func,
}

Table.defaultProps = {
    header: [],
    row: [],
    colsTemplate: undefined,
    topElms: null,
    footer: null,
    loading: false,
    emptyText: '無任何一筆資料，趕快新增一筆資料吧',
    emptyContent: null,
    withCheckbox: false,
    withEdit: false,
    selectedKeys: [],
    onSelectionChange: null,
    onToggle: null,
    pendingToggles: [],
    rowIds: null,
    onEdit: null,
}

export default Table

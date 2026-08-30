export const hashMapDataExtractor = (hastMapData) => {

    if (hastMapData) {

        const keys = Object.keys(hastMapData);

        const data = keys.map(key => hastMapData[key]);

        return data;
    }

    return []
}


export const timeGenerator = () => new Date().toLocaleString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
})

export const initFormData = (companyInfo, showData) => {


    const data = new Map()

    if (companyInfo) {
        Object.keys(showData).forEach(key => {
            data.set(key, showData[key].map((data, i) => { return { [data]: companyInfo[key][data] } }))
        })
        return data;
    }
    return []
}

export const keyValueGenerator = (hashMapData, hashObjectKeys, hashObjectValues) => {

    if (hashMapData) {
        let inputs = {}
        Object.keys(hashObjectKeys).forEach((key, index) => {
            const data = hashMapData.get(key);

            hashObjectKeys[key].forEach((item, index) => {
                inputs[item] = data[index][item]
            })
        })
        return inputs
    }

    if (!hashMapData) {

        const data = new Map()

        if (hashObjectValues) {
            Object.keys(hashObjectKeys).forEach(key => {
                data.set(key, hashObjectKeys[key].map((data, i) => { return { [data]: hashObjectValues[key][data] } }))

            })
            //hashMap
            return data;
        }
        return []
    }


}


export const updateObjectState = (state, setState, key, value) => {

    const newObj = Object.assign({}, state);

    newObj[key] = value;

    setState(newObj)
}


//樹狀數據搜索
export const searchTree = (element, matchingName) => {
    if (element.name.includes(matchingName)) {
        return element;
    } else if (element.children != null) {
        var i;
        var result = null;
        for (i = 0; result == null && i < element.children.length; i++) {
            result = searchTree(element.children[i], matchingName);
        }
        return result;
    }
    return null;
};

/**
 * 
 * @param {Object} item 
 * @param {[Object]} selectedItems 
 * @param {[Object]} setSelectedItems 
 */

export const handleSelect = (item, selectedItems, setSelectedItems, multiple) => {

    const newSelected = [...selectedItems];
    console.log('selectedItems', selectedItems)
    const isSelected = newSelected.findIndex(selectedItems => selectedItems.value === item.value);



    if (isSelected !== -1) {

        setSelectedItems(newSelected.slice(isSelected, 1))

    }


    else {

        if (multiple) {
            newSelected.push(item)
            setSelectedItems(newSelected)

        }
        else {
            setSelectedItems([item])
        }
    }
}


export const handleOnSelect = (
    multiple,
    item,
    selected,
    setSelected,
    key,
    messageWhenSelectSameItem,
    removeWhenSelectSameItem,
    type = "select"
) => {
    let newSelected = [...selected];

    const isExist = newSelected.findIndex(
        (element) => element[key] === item[key]
    );

    if (
        isExist !== -1 &&
        messageWhenSelectSameItem.length > 0 &&
        type !== "remove"
    ) {
        Alert.alert("", messageWhenSelectSameItem);
    }

    if (multiple) {
        if (isExist !== -1) {
            if (removeWhenSelectSameItem || type === "remove") {
                newSelected.splice(isExist, 1);
            }
        } else {
            newSelected.push(item);
        }
        setSelected(newSelected);
    } else {
        if (isExist !== -1) {
            setSelected([]);
        } else {
            setSelected([item]);
        }
    }
};
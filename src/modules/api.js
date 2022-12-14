import { sortObj, filterArr } from './utils.js';
import { WAQI_URL, USER_INFO_MOW_URL, MAPBOX_URL } from './constans.js';

/** класс, содержит методы обращения к различным апи */
class Api {
    /**
     * @description - метод обращения к апи, с запасным вариантом локальных данных, 
     * если основные апи не отвечают, либо отвечают с ошибками
     * @param {String} url - урл, по которому обращаемся к апи
     * @param {String} [spareUrl=''] - запасной урл, по которому обращаемся к апи
     * @return {Array<Object>} - данные, полученные от апи
     */
    async wrapFetchCall( url, spareUrl = '' ) {
        try {
            let controller = new AbortController()
            setTimeout(() => controller.abort(), 3000); 
            let resp = await fetch(url, {signal: controller.signal});

            if (!resp && spareUrl || resp.status != 'ok' && spareUrl) {
                resp = await fetch(spareUrl);
            } else if (!resp && spareUrl || resp.status != 'ok' && spareUrl) {
                throw new Error(`HTTP error! status: ${resp.status}`);
            }

            return await resp.json();
        } catch (e) {
            console.log(e);

            if(spareUrl) {
                let resp = await fetch(spareUrl);  
                return await resp.json();
            }
        }
    }

    /**
     * @description - метод получает данные по конкретному городу
     * @param {String} lat - ширина координат
     * @param {String} lon - долгота координат
     * @param {Object} aqi - данные aqi по этому городу
     * @return {Array<Object>} - данные по конкретному городу
     */
    getCity = async (lat, lon, aqi) => {
        const url = MAPBOX_URL(lat, lon); 
        try {
            const response = await fetch(url);
            const body = await response.json();
            return [body.features[2].place_name, aqi];
        }
        catch (e) {
            console.error(e);
        }
    }

    /**
     * @description - возвращает список городов для таблицы
     * @param {Array<Object>} data - небработанный массив городов
     * @return {Array<Object>} - список городов для таблицы
     */
    getCities = async (data) => {
        let result = [];
        for (let i = 0; i < data.length; i += 1) {
            let el = await this.getCity(data[i].lat, data[i].lon, data[i].aqi);
            if (!result.includes(el)) {
                result.push(el);
            }

            if (result.length === 5) return result;
        }
    }

    /**
     * @description - определяет местоположения пользователя
     */
    async getUserLocation() {
        function success({ coords }) {
            const { latitude, longitude } = coords;
            window.userLocation = {
                latitude: latitude, 
                longitude: longitude
            };
        }
          
        function error({ message }) {
            console.log(message);
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(success.bind(this), error, {
                enableHighAccuracy: true
            }) 
        }
    }

    /**
     * @description - возвращает исторические данные чистоты воздуха по местоположению пользователя
     * @param {String} lat - ширина координат
     * @param {String} lon - долгота координат
     * @return {Array<Object>} - исторические данные чистоты воздуха по местоположению пользователя
     */
    getUserInfoHistory = async (lat, lon) => {
        try {
            const endTimestamp = + new Date();
            const startTimestamp = endTimestamp - 259200;
            const response = await this.wrapFetchCall(
                `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${
                    window.userLocation?.latitude || lat
                }&lon=${
                    window.userLocation?.longitude || lon
                }&start=${startTimestamp}&end=${endTimestamp}&appid=3368d25e656a521f14b4de50a62fbd93`, 
                'src/modules/spareApis/api-history.json'
            )
            return response;
        }
        catch (e) {
            console.error(e);
        }
    }

    /**
     * @description - возвращает данные для таблицы городов
     * @return {Object} - данные для таблицы городов
     */
    prepareTableData = async () => {
        const obj = await this.wrapFetchCall(WAQI_URL);
        let data = await sortObj(filterArr(obj.data));

        const dirtyCities = await this.getCities(data);
        const cleanCities = await this.getCities(data.reverse());
        return {dirtyCities, cleanCities};
    }

    /**
     * @description - возвращает данные для графика
     * @return {Object} - данные для графика
     */
    async prepareChartData() {
        const dataNow = await this.wrapFetchCall(USER_INFO_MOW_URL);
        const infoNow = await dataNow?.data;

        const chartData = await this.getUserInfoHistory(infoNow.city?.geo[0], infoNow.city?.geo[1]);
        return { chartData, infoNow };
    }
}

export default Api;